import { connectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { runSession, stopSession } from '../services/pollution.js';
import { CATEGORY_NAMES } from '../data/queries.js';

interface StartOptions {
  interval: string;
  batch: string;
  categories?: string;
}

export async function start(opts: StartOptions): Promise<void> {
  const intervalMin = parseInt(opts.interval, 10);
  const batchSize = parseInt(opts.batch, 10);

  if (isNaN(intervalMin) || intervalMin < 1) {
    console.error('--interval must be a positive integer (minutes)');
    process.exit(1);
  }
  if (isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
    console.error('--batch must be between 1 and 50');
    process.exit(1);
  }

  const categories = opts.categories
    ? opts.categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  const invalidCategories = categories.filter(c => !CATEGORY_NAMES.includes(c));
  if (invalidCategories.length > 0) {
    console.error(`Unknown categories: ${invalidCategories.join(', ')}`);
    console.error(`Valid categories: ${CATEGORY_NAMES.join(', ')}`);
    process.exit(1);
  }

  await connectDb();

  const session = await Session.create({
    status: 'running',
    config: { intervalMin, batchSize, categories },
  });

  console.log(`Session ${session.id} started`);
  console.log(`  batch=${batchSize}, interval=${intervalMin}min, categories=${categories.length > 0 ? categories.join(',') : 'all'}`);
  console.log('  Press Ctrl+C to stop\n');

  const handleShutdown = () => {
    console.log('\nStop signal received — finishing current query and shutting down...');
    stopSession(session.id as string);
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);

  await runSession(session.id as string, { intervalMin, batchSize, categories });

  console.log(`\nSession ${session.id} ended`);
  process.exit(0);
}
