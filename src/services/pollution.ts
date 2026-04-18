import chalk from 'chalk';
import cron from 'node-cron';
import type { BrowserContext } from 'playwright';
import { launchBrowser, closeBrowser, fireQuery } from './browser.js';
import { buildRotatedQueryPlan, abortableSleep, randomInt, shuffle } from './randomizer.js';
import { Session } from '../models/Session.js';
import { Query } from '../models/Query.js';
import { QUERY_MAP, CATEGORY_NAMES } from '../data/queries.js';

export interface SessionConfig {
  intervalMin: number;
  batchSize: number;
  categories: string[];
  cronExpr?: string;
}

const activeControllers = new Map<string, AbortController>();

export function isSessionActive(sessionId: string): boolean {
  return activeControllers.has(sessionId);
}

export function stopSession(sessionId: string): boolean {
  const controller = activeControllers.get(sessionId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function getActiveSessions(): string[] {
  return Array.from(activeControllers.keys());
}

export async function runSession(sessionId: string, config: SessionConfig): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(sessionId, controller);

  const categories = config.categories.length > 0 ? config.categories : CATEGORY_NAMES;

  await Session.findByIdAndUpdate(sessionId, { status: 'running' });

  const context = await launchBrowser();

  // Per-session query pool — exhausted before any query repeats
  const queryPool = buildQueryPool(categories);

  try {
    if (config.cronExpr) {
      await runWithCronSchedule(context, sessionId, categories, queryPool, config, controller);
    } else {
      await runWithIntervalLoop(context, sessionId, categories, queryPool, config, controller);
    }
  } catch (error) {
    console.error(chalk.red(`Session ${sessionId} error:`), error);
    await Session.findByIdAndUpdate(sessionId, {
      status: 'error',
      endedAt: new Date(),
    }).catch(err => console.error('Failed to mark session as error:', err));
    return;
  } finally {
    await closeBrowser();
    activeControllers.delete(sessionId);
  }

  await Session.findByIdAndUpdate(sessionId, {
    status: controller.signal.aborted ? 'stopped' : 'completed',
    endedAt: new Date(),
  }).catch(err => console.error('Failed to update session status:', err));
}

async function runWithIntervalLoop(
  context: BrowserContext,
  sessionId: string,
  categories: string[],
  queryPool: QueryPool,
  config: SessionConfig,
  controller: AbortController,
): Promise<void> {
  while (!controller.signal.aborted) {
    await fireBatch(context, sessionId, categories, queryPool, config.batchSize, controller.signal);

    if (controller.signal.aborted) break;

    console.log(chalk.dim(`Batch complete. Next batch in ${config.intervalMin} minute(s).`));
    await abortableSleep(config.intervalMin * 60 * 1000, controller.signal);
  }
}

async function runWithCronSchedule(
  context: BrowserContext,
  sessionId: string,
  categories: string[],
  queryPool: QueryPool,
  config: SessionConfig,
  controller: AbortController,
): Promise<void> {
  console.log(chalk.dim(`Session scheduled with cron: ${config.cronExpr}`));

  await new Promise<void>(resolve => {
    const task = cron.schedule(config.cronExpr!, async () => {
      if (controller.signal.aborted) {
        task.stop();
        resolve();
        return;
      }

      console.log(chalk.cyan(`[cron] Firing batch — ${new Date().toLocaleString()}`));
      await fireBatch(
        context, sessionId, categories, queryPool, config.batchSize, controller.signal
      ).catch(err => console.error(chalk.red('Batch error:'), err));
    });

    controller.signal.addEventListener('abort', () => {
      task.stop();
      resolve();
    }, { once: true });
  });
}

export async function fireImmediate(
  sessionId: string,
  count: number,
  categories: string[],
): Promise<void> {
  const pool = categories.length > 0 ? categories : CATEGORY_NAMES;
  const queryPool = buildQueryPool(pool);
  const controller = new AbortController();

  const context = await launchBrowser();
  try {
    await fireBatch(context, sessionId, pool, queryPool, count, controller.signal);
  } finally {
    await closeBrowser();
  }
}

async function fireBatch(
  context: BrowserContext,
  sessionId: string,
  categories: string[],
  queryPool: QueryPool,
  batchSize: number,
  signal: AbortSignal,
): Promise<void> {
  const plan = drawFromPool(queryPool, categories, batchSize);

  for (const { category, text } of plan) {
    if (signal.aborted) break;

    console.log(`  ${chalk.cyan(`[${category}]`)} ${text}`);

    const result = await fireQuery(context, text, category);

    const query = new Query({ sessionId, ...result });
    await query.save();

    await Session.findByIdAndUpdate(sessionId, { $inc: { queriesFired: 1 } });

    if (result.success) {
      console.log(
        `  ${chalk.green('✓')} "${result.pageTitleAfter}" ` +
        chalk.dim(`load=${result.loadTimeMs}ms dwell=${result.dwellMs}ms`) +
        (result.clickedResultUrl ? chalk.dim(' +click') : '')
      );
    } else {
      console.log(`  ${chalk.red('✗')} ${result.errorMsg}`);
    }

    if (!signal.aborted) {
      await abortableSleep(randomInt(4000, 15000), signal);
    }
  }
}

// --- Query pool: exhausts all queries before repeating any ---

interface QueryPool {
  remaining: Map<string, string[]>;   // category → shuffled unused queries
  exhausted: Map<string, string[]>;   // category → queries to recycle into remaining
}

function buildQueryPool(categories: string[]): QueryPool {
  const remaining = new Map<string, string[]>();
  const exhausted = new Map<string, string[]>();
  for (const cat of categories) {
    remaining.set(cat, shuffle(QUERY_MAP[cat] ?? []));
    exhausted.set(cat, []);
  }
  return { remaining, exhausted };
}

function drawFromPool(
  pool: QueryPool,
  categories: string[],
  count: number,
): Array<{ category: string; text: string }> {
  const result: Array<{ category: string; text: string }> = [];
  let lastCategory: string | null = null;

  for (let i = 0; i < count; i++) {
    const eligible = categories.filter(c => c !== lastCategory);
    const pool_ = eligible.length > 0 ? eligible : categories;

    // Prefer categories with unseen queries; fall back to any eligible category
    const withUnseen = pool_.filter(c => (pool.remaining.get(c)?.length ?? 0) > 0);
    const candidatePool = withUnseen.length > 0 ? withUnseen : pool_;
    const category = candidatePool[Math.floor(Math.random() * candidatePool.length)];

    // Recycle only the chosen category when its unseen bucket is empty
    if ((pool.remaining.get(category)?.length ?? 0) === 0) {
      const ex = pool.exhausted.get(category) ?? [];
      pool.remaining.set(category, shuffle(ex));
      pool.exhausted.set(category, []);
    }

    const queries = pool.remaining.get(category) ?? [];
    if (queries.length === 0) continue;

    const text = queries.pop()!;
    pool.exhausted.get(category)!.push(text);

    result.push({ category, text });
    lastCategory = category;
  }

  return result;
}
