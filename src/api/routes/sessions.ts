import { Router } from 'express';
import type { Request, Response } from 'express';
import cron from 'node-cron';
import { Session } from '../../models/Session.js';
import { Query } from '../../models/Query.js';
import { runSession, stopSession, getActiveSessions } from '../../services/pollution.js';
import { isBrowserActive } from '../../services/browser.js';
import { CATEGORY_NAMES } from '../../data/queries.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { intervalMin = 10, batchSize = 5, categories = [], cronExpr } = req.body as {
    intervalMin?: number;
    batchSize?: number;
    categories?: string[];
    cronExpr?: string;
  };

  if (batchSize < 1 || batchSize > 50) {
    res.status(400).json({ error: 'batchSize must be between 1 and 50' });
    return;
  }

  if (cronExpr !== undefined && !cron.validate(cronExpr)) {
    res.status(400).json({ error: `Invalid cron expression: "${cronExpr}"` });
    return;
  }

  const invalidCategories = categories.filter(c => !CATEGORY_NAMES.includes(c));
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
    config: { intervalMin: cronExpr ? 0 : intervalMin, batchSize, categories },
  });

  runSession(session.id as string, { intervalMin, batchSize, categories, cronExpr }).catch(err =>
    console.error(`Session ${session.id} background error:`, err)
  );

  res.status(201).json({ session });
});

router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 200);
  const skip = parseInt((req.query.skip as string) ?? '0', 10);
  const validStatuses = ['running', 'stopped', 'completed', 'error'];
  const statusFilter = req.query.status as string | undefined;

  if (statusFilter && !validStatuses.includes(statusFilter)) {
    res.status(400).json({ error: `Invalid status filter. Valid values: ${validStatuses.join(', ')}` });
    return;
  }

  const filter = statusFilter ? { status: statusFilter } : {};
  const [sessions, total] = await Promise.all([
    Session.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit),
    Session.countDocuments(filter),
  ]);
  res.json({ sessions, total, limit, skip });
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

  if (session.status !== 'running') {
    res.status(400).json({ error: `Session is already in status "${session.status}"` });
    return;
  }

  const aborted = stopSession(req.params.id);

  if (!aborted) {
    await Session.findByIdAndUpdate(req.params.id, { status: 'stopped', endedAt: new Date() });
    res.json({ success: true, message: 'Session marked stopped (was not active in this process)' });
    return;
  }

  res.json({ success: true, message: 'Session stop signal sent' });
});

export default router;
