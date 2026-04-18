import chalk from 'chalk';
import { connectDb, disconnectDb } from '../db.js';
import { Session } from '../models/Session.js';
import { stopSession } from '../services/pollution.js';

export async function stop(): Promise<void> {
  await connectDb();

  const running = await Session.findOne({ status: 'running' }).sort({ startedAt: -1 });

  if (!running) {
    console.log(chalk.yellow('No running sessions found in database'));
    await disconnectDb();
    return;
  }

  const aborted = stopSession(running.id as string);

  if (aborted) {
    console.log(chalk.green(`Session ${running.id} stopped (was active in this process)`));
  } else {
    await Session.findByIdAndUpdate(running.id, { status: 'stopped', endedAt: new Date() });
    console.log(chalk.yellow(`Session ${running.id} marked as stopped`));
    console.log(chalk.dim('Note: if the session is running in another process, Ctrl+C that process too'));
  }

  await disconnectDb();
}
