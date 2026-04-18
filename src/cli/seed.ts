import chalk from 'chalk';
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
      console.log(chalk.dim(`  skip  ${cat.icon}  ${cat.name}`));
      skipped++;
      continue;
    }
    await Category.create(cat);
    inserted++;
    console.log(chalk.green(`  added ${cat.icon}  ${cat.name}`) + chalk.dim(` (${cat.queries.length} queries)`));
  }

  console.log(`\n${chalk.bold('Done')} — ${chalk.green(inserted + ' inserted')}, ${chalk.dim(skipped + ' already existed')}`);
  await disconnectDb();
}
