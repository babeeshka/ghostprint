import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isBrowserActive } from '../../services/browser.js';
import { getActiveSessions } from '../../services/pollution.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? 'connected' :
    dbState === 2 ? 'connecting' :
    dbState === 3 ? 'disconnecting' :
    'disconnected';

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    db: dbStatus,
    browserActive: isBrowserActive(),
    activeSessions: getActiveSessions(),
  });
});

export default router;
