import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { getActiveSessions } from '../services/pollution.js';

export async function status(): Promise<void> {
  await connectDb();

  const activeIds = getActiveSessions();
  const recentSessions = await Session.find().sort({ startedAt: -1 }).limit(5);

  if (activeIds.length > 0) {
    console.log(`Active sessions in this process: ${activeIds.join(', ')}`);
  } else {
    console.log('No active sessions in this process');
  }

  if (recentSessions.length === 0) {
    console.log('No sessions in database');
    await disconnectDb();
    return;
  }

  console.log('\nRecent sessions:');
  for (const s of recentSessions) {
    const duration = s.endedAt
      ? `${Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)}s`
      : 'ongoing';
    console.log(
      `  ${s.id}  ${s.status.padEnd(10)}  queries=${s.queriesFired}  duration=${duration}  started=${s.startedAt.toLocaleString()}`
    );
  }

  await disconnectDb();
}
