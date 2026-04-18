import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session } from '../../models/Session.js';
import { Query } from '../../models/Query.js';
import { fireImmediate } from '../../services/pollution.js';
import { CATEGORY_NAMES } from '../../data/queries.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { count = 3, categories = [] } = req.body as {
    count?: number;
    categories?: string[];
  };

  if (count < 1 || count > 20) {
    res.status(400).json({ error: 'count must be between 1 and 20' });
    return;
  }

  const invalidCategories = categories.filter((c: string) => !CATEGORY_NAMES.includes(c));
  if (invalidCategories.length > 0) {
    res.status(400).json({ error: `Unknown categories: ${invalidCategories.join(', ')}` });
    return;
  }

  const session = await Session.create({
    status: 'running',
    config: { intervalMin: 0, batchSize: count, categories },
  });

  try {
    await fireImmediate(session.id as string, count, categories);

    await Session.findByIdAndUpdate(session.id, {
      status: 'completed',
      endedAt: new Date(),
    });

    const queries = await Query.find({ sessionId: session.id }).sort({ firedAt: 1 });
    res.json({ sessionId: session.id, queries });
  } catch (error) {
    await Session.findByIdAndUpdate(session.id, {
      status: 'error',
      endedAt: new Date(),
    });
    throw error;
  }
});

export default router;
