import 'dotenv/config';
import mongoose from 'mongoose';

let connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

export async function connectDb(): Promise<void> {
  if (connectionState === 'connected') return;
  if (connectionState === 'connecting') {
    await new Promise<void>(resolve => mongoose.connection.once('connected', resolve));
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set — check your .env file');

  connectionState = 'connecting';
  await mongoose.connect(uri);
  connectionState = 'connected';
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

export async function disconnectDb(): Promise<void> {
  if (connectionState !== 'connected') return;
  await mongoose.disconnect();
  connectionState = 'disconnected';
}

/**
 * On process startup, any sessions left in 'running' state are stale —
 * they belong to a previous process that crashed or was killed. Mark them
 * as 'error' so status/stats are accurate.
 */
export async function recoverStaleSessions(): Promise<void> {
  const { Session } = await import('./models/Session.js');
  const result = await Session.updateMany(
    { status: 'running' },
    { status: 'error', endedAt: new Date() }
  );
  if (result.modifiedCount > 0) {
    console.warn(`Recovered ${result.modifiedCount} stale session(s) from previous run`);
  }
}
