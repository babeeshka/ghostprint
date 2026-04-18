import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session } from '../../models/Session.js';
import { Query } from '../../models/Query.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [
    totalQueries,
    totalSessions,
    uniqueQueryTexts,
    byDay,
    byCategory,
    qualityAgg,
  ] = await Promise.all([
    Query.countDocuments(),
    Session.countDocuments(),
    Query.distinct('text'),
    Query.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$firedAt' } },
          count: { $sum: 1 },
          successes: { $sum: { $cond: ['$success', 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]),
    Query.aggregate([
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
      {
        $group: {
          _id: null,
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          totalCount: { $sum: 1 },
          avgDwellMs: { $avg: '$dwellMs' },
          avgLoadMs: { $avg: '$loadTimeMs' },
          clickCount: { $sum: { $cond: [{ $ifNull: ['$clickedResultUrl', false] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const q = qualityAgg[0] ?? { successCount: 0, totalCount: 0, avgDwellMs: 0, avgLoadMs: 0, clickCount: 0 };

  res.json({
    totalQueries,
    totalSessions,
    uniqueQueries: uniqueQueryTexts.length,
    successRate: q.totalCount > 0 ? Math.round((q.successCount / q.totalCount) * 100) : 0,
    avgDwellMs: Math.round(q.avgDwellMs ?? 0),
    avgLoadMs: Math.round(q.avgLoadMs ?? 0),
    clickThroughRate: q.totalCount > 0 ? Math.round((q.clickCount / q.totalCount) * 100) : 0,
    byDay: byDay.map(d => ({
      date: d._id as string,
      count: d.count as number,
      successRate: d.count > 0 ? Math.round((d.successes / d.count) * 100) : 0,
    })),
    byCategory: byCategory.map(c => ({
      category: c._id as string,
      count: c.count as number,
      successRate: c.count > 0 ? Math.round((c.successes / c.count) * 100) : 0,
      avgDwellMs: Math.round(c.avgDwellMs ?? 0),
      avgLoadMs: Math.round(c.avgLoadMs ?? 0),
      clickThroughRate: c.count > 0 ? Math.round((c.clicks / c.count) * 100) : 0,
    })),
  });
});

export default router;
