import { connectDb, disconnectDb } from '../db.js';
import { Category } from '../models/Category.js';
import { CATEGORIES } from '../data/queries.js';

export async function seed(): Promise<void> {
  await connectDb();

  let inserted = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const existing = await Category.findOne({ name: cat.name });
    if (existing) {
      skipped++;
      continue;
    }
    await Category.create(cat);
    inserted++;
    console.log(`  Seeded: ${cat.icon} ${cat.name} (${cat.queries.length} queries)`);
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} already existed`);
  await disconnectDb();
}
