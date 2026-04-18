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
    console.error('--count must be between 1 and 20');
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
    config: { intervalMin: 0, batchSize: count, categories },
  });

  console.log(`Firing ${count} quer${count === 1 ? 'y' : 'ies'} immediately...\n`);

  try {
    await fireImmediate(session.id as string, count, categories);

    await Session.findByIdAndUpdate(session.id, {
      status: 'completed',
      endedAt: new Date(),
    });

    console.log(`\nDone — session ${session.id}`);
  } catch (error) {
    await Session.findByIdAndUpdate(session.id, { status: 'error', endedAt: new Date() });
    console.error('Fire failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await disconnectDb();
  }
}
