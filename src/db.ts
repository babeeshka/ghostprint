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
