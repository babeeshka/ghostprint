import 'dotenv/config';
import express from 'express';
import { connectDb, recoverStaleSessions } from './db.js';
import apiRouter from './api/index.js';

const port = parseInt(process.env.API_PORT ?? '3737', 10);

async function main() {
  await connectDb();
  await recoverStaleSessions();

  const app = express();
  app.use(express.json());
  app.use(apiRouter);

  app.listen(port, () => {
    console.log(`ghost-profile API running on http://localhost:${port}`);
  });
}

main().catch(err => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
