import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session } from '../../models/Session.js';
import { fireImmediate } from '../../services/pollution.js';
import { isBrowserActive, } from '../../services/browser.js';
import { getActiveSessions } from '../../services/pollution.js';
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

  if (isBrowserActive()) {
    res.status(409).json({
      error: 'Browser is already in use by another session',
      activeSessions: getActiveSessions(),
    });
    return;
  }

  const session = await Session.create({
    status: 'running',
    config: { intervalMin: 0, batchSize: count, categories },
  });

  // Fire in background — respond immediately with the session ID so the
  // caller can poll GET /sessions/:id for results rather than waiting minutes.
  fireImmediate(session.id as string, count, categories)
    .then(() =>
      Session.findByIdAndUpdate(session.id, { status: 'completed', endedAt: new Date() })
    )
    .catch(err => {
      console.error(`fire job ${session.id} failed:`, err);
      return Session.findByIdAndUpdate(session.id, { status: 'error', endedAt: new Date() });
    });

  res.status(202).json({
    sessionId: session.id,
    message: 'Firing in background — poll GET /sessions/:id for results',
  });
});

export default router;
