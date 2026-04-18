import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session } from '../../models/Session.js';
import { Query } from '../../models/Query.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [totalQueries, totalSessions, uniqueQueryTexts, byDay, byCategory] = await Promise.all([
    Query.countDocuments(),
    Session.countDocuments(),
    Query.distinct('text'),
    Query.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$firedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]),
    Query.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({
    totalQueries,
    totalSessions,
    uniqueQueries: uniqueQueryTexts.length,
    byDay: byDay.map(d => ({ date: d._id as string, count: d.count as number })),
    byCategory: byCategory.map(c => ({
      category: c._id as string,
      count: c.count as number,
    })),
  });
});

export default router;
