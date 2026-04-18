import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session } from '../../models/Session.js';
import { Query } from '../../models/Query.js';
import { runSession, stopSession, isSessionActive } from '../../services/pollution.js';
import { CATEGORY_NAMES } from '../../data/queries.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { intervalMin = 10, batchSize = 5, categories = [] } = req.body as {
    intervalMin?: number;
    batchSize?: number;
    categories?: string[];
  };

  if (batchSize < 1 || batchSize > 50) {
    res.status(400).json({ error: 'batchSize must be between 1 and 50' });
    return;
  }

  const invalidCategories = categories.filter(c => !CATEGORY_NAMES.includes(c));
  if (invalidCategories.length > 0) {
    res.status(400).json({ error: `Unknown categories: ${invalidCategories.join(', ')}` });
    return;
  }

  const session = await Session.create({
    status: 'running',
    config: { intervalMin, batchSize, categories },
  });

  // Run in background — do not await
  runSession(session.id as string, { intervalMin, batchSize, categories }).catch(err =>
    console.error(`Session ${session.id} background error:`, err)
  );

  res.status(201).json({ session });
});

router.get('/', async (_req: Request, res: Response) => {
  const sessions = await Session.find().sort({ startedAt: -1 }).limit(100);
  res.json({ sessions });
});

router.get('/:id', async (req: Request, res: Response) => {
  const session = await Session.findById(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const queries = await Query.find({ sessionId: req.params.id }).sort({ firedAt: 1 });
  res.json({ session, queries });
});

router.post('/:id/stop', async (req: Request, res: Response) => {
  const session = await Session.findById(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const aborted = stopSession(req.params.id);

  if (!aborted) {
    if (session.status === 'running') {
      await Session.findByIdAndUpdate(req.params.id, {
        status: 'stopped',
        endedAt: new Date(),
      });
      res.json({ success: true, message: 'Session marked stopped (was not active in this process)' });
    } else {
      res.status(400).json({ error: `Session is already in status "${session.status}"` });
    }
    return;
  }

  res.json({ success: true, message: 'Session stop signal sent' });
});

export default router;
