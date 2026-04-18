import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { Query } from '../models/Query.js';
import { parseSince } from '../services/randomizer.js';
import Table from 'cli-table3';

interface StatsOptions {
  since?: string;
}

export async function stats(opts: StatsOptions): Promise<void> {
  await connectDb();

  const sinceDate = opts.since ? parseSince(opts.since) : undefined;
  const dateFilter = sinceDate ? { firedAt: { $gte: sinceDate } } : {};

  const [totalQueries, totalSessions, uniqueQueryTexts, byCategory, byDay] = await Promise.all([
    Query.countDocuments(dateFilter),
    Session.countDocuments(sinceDate ? { startedAt: { $gte: sinceDate } } : {}),
    Query.distinct('text', dateFilter),
    Query.aggregate([
      ...(sinceDate ? [{ $match: { firedAt: { $gte: sinceDate } } }] : []),
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Query.aggregate([
      ...(sinceDate ? [{ $match: { firedAt: { $gte: sinceDate } } }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$firedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 14 },
    ]),
  ]);

  const label = opts.since ? `last ${opts.since}` : 'all time';
  console.log(`\nGhost Profile Stats (${label})\n`);

  console.log(`  Total queries fired : ${totalQueries}`);
  console.log(`  Unique queries      : ${uniqueQueryTexts.length}`);
  console.log(`  Total sessions      : ${totalSessions}`);

  if (byCategory.length > 0) {
    console.log('\nBy Category:');
    const catTable = new Table({
      head: ['Category', 'Queries'],
      colWidths: [20, 10],
      style: { head: ['cyan'] },
    });
    for (const row of byCategory) {
      catTable.push([row._id as string, (row.count as number).toString()]);
    }
    console.log(catTable.toString());
  }

  if (byDay.length > 0) {
    console.log('\nBy Day (most recent first):');
    const dayTable = new Table({
      head: ['Date', 'Queries'],
      colWidths: [14, 10],
      style: { head: ['cyan'] },
    });
    for (const row of byDay) {
      dayTable.push([row._id as string, (row.count as number).toString()]);
    }
    console.log(dayTable.toString());
  }

  console.log('');
  await disconnectDb();
}
