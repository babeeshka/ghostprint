import chalk from 'chalk';
import cron from 'node-cron';
import { connectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { runSession, stopSession } from '../services/pollution.js';
import { CATEGORY_NAMES } from '../data/queries.js';

interface StartOptions {
  interval: string;
  batch: string;
  categories?: string;
  cron?: string;
}

export async function start(opts: StartOptions): Promise<void> {
  const batchSize = parseInt(opts.batch, 10);

  if (isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
    console.error(chalk.red('--batch must be between 1 and 50'));
    process.exit(1);
  }

  const categories = opts.categories
    ? opts.categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  const invalidCategories = categories.filter(c => !CATEGORY_NAMES.includes(c));
  if (invalidCategories.length > 0) {
    console.error(chalk.red(`Unknown categories: ${invalidCategories.join(', ')}`));
    console.error(chalk.dim(`Valid: ${CATEGORY_NAMES.join(', ')}`));
    process.exit(1);
  }

  let intervalMin = 0;
  let cronExpr: string | undefined;

  if (opts.cron) {
    if (!cron.validate(opts.cron)) {
      console.error(chalk.red(`Invalid cron expression: "${opts.cron}"`));
      console.error(chalk.dim('Example: "0 23 * * *" fires at 11pm every night'));
      process.exit(1);
    }
    cronExpr = opts.cron;
  } else {
    intervalMin = parseInt(opts.interval, 10);
    if (isNaN(intervalMin) || intervalMin < 1) {
      console.error(chalk.red('--interval must be a positive integer (minutes)'));
      process.exit(1);
    }
  }

  await connectDb();

  const session = await Session.create({
    status: 'running',
    config: { intervalMin, batchSize, categories },
  });

  const scheduleLabel = cronExpr
    ? `cron="${cronExpr}"`
    : `interval=${intervalMin}min`;

  const catLabel = categories.length > 0 ? categories.join(',') : 'all';

  console.log(chalk.bold(`\nSession ${chalk.cyan(session.id as string)} started`));
  console.log(chalk.dim(`  batch=${batchSize}  ${scheduleLabel}  categories=${catLabel}`));
  console.log(chalk.dim('  Press Ctrl+C to stop\n'));

  const handleShutdown = () => {
    console.log(chalk.yellow('\nStop signal received — finishing current query and shutting down...'));
    stopSession(session.id as string);
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);

  await runSession(session.id as string, { intervalMin, batchSize, categories, cronExpr });

  console.log(chalk.bold(`\nSession ${session.id} ended`));
  process.exit(0);
}
