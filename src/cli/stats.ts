import chalk from 'chalk';
import Table from 'cli-table3';
import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { Query } from '../models/Query.js';
import { parseSince } from '../services/randomizer.js';

interface StatsOptions {
  since?: string;
}

export async function stats(opts: StatsOptions): Promise<void> {
  await connectDb();

  const sinceDate = opts.since ? parseSince(opts.since) : undefined;
  const dateFilter = sinceDate ? { firedAt: { $gte: sinceDate } } : {};
  const matchStage = sinceDate ? [{ $match: { firedAt: { $gte: sinceDate } } }] : [];

  const [totalQueries, totalSessions, uniqueQueryTexts, byCategory, byDay, qualityAgg] =
    await Promise.all([
      Query.countDocuments(dateFilter),
      Session.countDocuments(sinceDate ? { startedAt: { $gte: sinceDate } } : {}),
      Query.distinct('text', dateFilter),
      Query.aggregate([
        ...matchStage,
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            successes: { $sum: { $cond: ['$success', 1, 0] } },
            avgDwellMs: { $avg: '$dwellMs' },
            avgLoadMs: { $avg: '$loadTimeMs' },
            clicks: { $sum: { $cond: [{ $ifNull: ['$clickedResultUrl', false] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Query.aggregate([
        ...matchStage,
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$firedAt' } },
            count: { $sum: 1 },
            successes: { $sum: { $cond: ['$success', 1, 0] } },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 14 },
      ]),
      Query.aggregate([
        ...matchStage,
        {
          $group: {
            _id: null,
            successCount: { $sum: { $cond: ['$success', 1, 0] } },
            totalCount: { $sum: 1 },
            avgDwellMs: { $avg: '$dwellMs' },
            avgLoadMs: { $avg: '$loadTimeMs' },
            clickCount: {
              $sum: { $cond: [{ $ifNull: ['$clickedResultUrl', false] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

  const q = qualityAgg[0] ?? {
    successCount: 0, totalCount: 0, avgDwellMs: 0, avgLoadMs: 0, clickCount: 0,
  };
  const successRate = q.totalCount > 0
    ? Math.round((q.successCount / q.totalCount) * 100)
    : 0;
  const ctrRate = q.totalCount > 0
    ? Math.round((q.clickCount / q.totalCount) * 100)
    : 0;

  const label = opts.since ? `last ${opts.since}` : 'all time';
  console.log(chalk.bold(`\nGhost Profile Stats (${label})\n`));

  console.log(`  Total queries fired : ${chalk.cyan(totalQueries.toString())}`);
  console.log(`  Unique queries      : ${chalk.cyan(uniqueQueryTexts.length.toString())}`);
  console.log(`  Total sessions      : ${chalk.cyan(totalSessions.toString())}`);
  console.log(`  Success rate        : ${successRate >= 90 ? chalk.green(successRate + '%') : chalk.yellow(successRate + '%')}`);
  console.log(`  Avg dwell time      : ${chalk.dim(Math.round(q.avgDwellMs ?? 0) + 'ms')}`);
  console.log(`  Avg load time       : ${chalk.dim(Math.round(q.avgLoadMs ?? 0) + 'ms')}`);
  console.log(`  Click-through rate  : ${chalk.dim(ctrRate + '%')}`);

  if (byCategory.length > 0) {
    console.log('\nBy Category:');
    const catTable = new Table({
      head: ['Category', 'Queries', 'Success%', 'Avg Dwell', 'CTR%'],
      colWidths: [18, 10, 11, 12, 8],
      style: { head: ['cyan'] },
    });
    for (const row of byCategory) {
      const sr = row.count > 0 ? Math.round((row.successes / row.count) * 100) : 0;
      const ctr = row.count > 0 ? Math.round((row.clicks / row.count) * 100) : 0;
      catTable.push([
        row._id as string,
        (row.count as number).toString(),
        sr + '%',
        Math.round(row.avgDwellMs ?? 0) + 'ms',
        ctr + '%',
      ]);
    }
    console.log(catTable.toString());
  }

  if (byDay.length > 0) {
    console.log('\nBy Day (most recent first):');
    const dayTable = new Table({
      head: ['Date', 'Queries', 'Success%'],
      colWidths: [14, 10, 11],
      style: { head: ['cyan'] },
    });
    for (const row of byDay) {
      const sr = row.count > 0 ? Math.round((row.successes / row.count) * 100) : 0;
      dayTable.push([row._id as string, (row.count as number).toString(), sr + '%']);
    }
    console.log(dayTable.toString());
  }

  console.log('');
  await disconnectDb();
}
