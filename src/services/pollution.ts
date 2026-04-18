import type { BrowserContext } from 'playwright';
import { launchBrowser, closeBrowser, fireQuery } from './browser.js';
import { buildRotatedQueryPlan, abortableSleep, randomInt } from './randomizer.js';
import { Session } from '../models/Session.js';
import { Query } from '../models/Query.js';
import { QUERY_MAP, CATEGORY_NAMES } from '../data/queries.js';

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

export async function runSession(
  sessionId: string,
  config: { intervalMin: number; batchSize: number; categories: string[] },
): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(sessionId, controller);

  const categories = config.categories.length > 0 ? config.categories : CATEGORY_NAMES;

  await Session.findByIdAndUpdate(sessionId, { status: 'running' });

  const context = await launchBrowser();

  try {
    while (!controller.signal.aborted) {
      await fireBatch(context, sessionId, categories, config.batchSize, controller.signal);

      if (controller.signal.aborted) break;

      console.log(`Batch complete. Next batch in ${config.intervalMin} minute(s).`);
      await abortableSleep(config.intervalMin * 60 * 1000, controller.signal);
    }
  } catch (error) {
    console.error(`Session ${sessionId} error:`, error);
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

export async function fireImmediate(
  sessionId: string,
  count: number,
  categories: string[],
): Promise<void> {
  const pool = categories.length > 0 ? categories : CATEGORY_NAMES;
  const controller = new AbortController();

  const context = await launchBrowser();
  try {
    await fireBatch(context, sessionId, pool, count, controller.signal);
  } finally {
    await closeBrowser();
  }
}

async function fireBatch(
  context: BrowserContext,
  sessionId: string,
  categories: string[],
  batchSize: number,
  signal: AbortSignal,
): Promise<void> {
  const plan = buildRotatedQueryPlan(categories, QUERY_MAP, batchSize);

  for (const { category, text } of plan) {
    if (signal.aborted) break;

    console.log(`  Firing [${category}]: "${text}"`);

    const result = await fireQuery(context, text, category);

    const query = new Query({ sessionId, ...result });
    await query.save();

    await Session.findByIdAndUpdate(sessionId, { $inc: { queriesFired: 1 } });

    if (result.success) {
      console.log(`  ✓ "${result.pageTitleAfter}" — dwell ${result.dwellMs}ms`);
    } else {
      console.log(`  ✗ FAILED: ${result.errorMsg}`);
    }

    if (!signal.aborted) {
      await abortableSleep(randomInt(4000, 15000), signal);
    }
  }
}
