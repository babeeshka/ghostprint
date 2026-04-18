import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'stopped' | 'completed' | 'error';
  config: {
    intervalMin: number;
    batchSize: number;
    categories: string[];
  };
  queriesFired: number;
}

const SessionSchema = new Schema<ISession>({
  startedAt: { type: Date, required: true, default: () => new Date() },
  endedAt: { type: Date },
  status: {
    type: String,
    enum: ['running', 'stopped', 'completed', 'error'],
    required: true,
    default: 'running',
  },
  config: {
    intervalMin: { type: Number, required: true },
    batchSize: { type: Number, required: true },
    categories: [{ type: String }],
  },
  queriesFired: { type: Number, default: 0 },
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);
