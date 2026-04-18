import chalk from 'chalk';
import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { fireImmediate } from '../services/pollution.js';
import { CATEGORY_NAMES } from '../data/queries.js';

interface FireOptions {
  count: string;
  categories?: string;
}

export async function fire(opts: FireOptions): Promise<void> {
  const count = parseInt(opts.count, 10);

  if (isNaN(count) || count < 1 || count > 20) {
    console.error(chalk.red('--count must be between 1 and 20'));
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

  await connectDb();

  const session = await Session.create({
    status: 'running',
    config: { intervalMin: 0, batchSize: count, categories },
  });

  const catLabel = categories.length > 0 ? categories.join(',') : 'all';
  console.log(chalk.bold(`Firing ${count} quer${count === 1 ? 'y' : 'ies'} [${catLabel}]...\n`));

  try {
    await fireImmediate(session.id as string, count, categories);

    await Session.findByIdAndUpdate(session.id, {
      status: 'completed',
      endedAt: new Date(),
    });

    console.log(`\n${chalk.green('✓')} Done — session ${chalk.dim(session.id as string)}`);
  } catch (error) {
    await Session.findByIdAndUpdate(session.id, { status: 'error', endedAt: new Date() });
    console.error(chalk.red('Fire failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await disconnectDb();
  }
}
