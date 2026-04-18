import { Router } from 'express';
import type { Request, Response } from 'express';
import { Category } from '../../models/Category.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
});

export default router;
