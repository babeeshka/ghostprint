import chalk from 'chalk';
import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { getActiveSessions } from '../services/pollution.js';

export async function status(): Promise<void> {
  await connectDb();

  const activeIds = getActiveSessions();

  if (activeIds.length > 0) {
    console.log(chalk.green(`Active sessions in this process: ${activeIds.join(', ')}`));
  } else {
    console.log(chalk.dim('No active sessions in this process'));
  }

  const recentSessions = await Session.find().sort({ startedAt: -1 }).limit(5);

  if (recentSessions.length === 0) {
    console.log(chalk.dim('No sessions in database'));
    await disconnectDb();
    return;
  }

  console.log('\nRecent sessions:');
  for (const s of recentSessions) {
    const duration = s.endedAt
      ? `${Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)}s`
      : 'ongoing';

    const statusColor =
      s.status === 'running' ? chalk.green :
      s.status === 'stopped' ? chalk.yellow :
      s.status === 'error'   ? chalk.red :
                               chalk.dim;

    console.log(
      `  ${chalk.dim(s.id as string)}  ${statusColor(s.status.padEnd(10))}  ` +
      `queries=${chalk.cyan(s.queriesFired.toString())}  duration=${duration}  ` +
      `started=${s.startedAt.toLocaleString()}`
    );
  }

  await disconnectDb();
}
