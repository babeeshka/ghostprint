import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import sessionsRouter from './routes/sessions.js';
import fireRouter from './routes/fire.js';
import statsRouter from './routes/stats.js';
import categoriesRouter from './routes/categories.js';

const router = Router();

router.use('/sessions', sessionsRouter);
router.use('/fire', fireRouter);
router.use('/stats', statsRouter);
router.use('/categories', categoriesRouter);

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('API error:', err);
  res.status(500).json({ error: message });
});

export default router;
