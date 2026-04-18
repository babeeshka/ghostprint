import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { stopSession } from '../services/pollution.js';

export async function stop(): Promise<void> {
  await connectDb();

  const running = await Session.findOne({ status: 'running' }).sort({ startedAt: -1 });

  if (!running) {
    console.log('No running sessions found in database');
    await disconnectDb();
    return;
  }

  const aborted = stopSession(running.id as string);

  if (aborted) {
    console.log(`Session ${running.id} stopped (was active in this process)`);
  } else {
    await Session.findByIdAndUpdate(running.id, { status: 'stopped', endedAt: new Date() });
    console.log(`Session ${running.id} marked as stopped`);
    console.log('Note: if the session is running in another process, you will need to Ctrl+C that process too');
  }

  await disconnectDb();
}
