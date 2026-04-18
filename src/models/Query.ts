import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IQuery extends Document {
  sessionId: Types.ObjectId;
  text: string;
  category: string;
  googleUrl: string;
  firedAt: Date;
  pageTitleAfter?: string;
  loadTimeMs?: number;
  dwellMs: number;
  clickedResultUrl?: string;
  success: boolean;
  errorMsg?: string;
}

const QuerySchema = new Schema<IQuery>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  text: { type: String, required: true },
  category: { type: String, required: true },
  googleUrl: { type: String, required: true },
  firedAt: { type: Date, required: true, default: () => new Date() },
  pageTitleAfter: { type: String },
  loadTimeMs: { type: Number },
  dwellMs: { type: Number, required: true },
  clickedResultUrl: { type: String },
  success: { type: Boolean, required: true, default: true },
  errorMsg: { type: String },
});

export const Query = mongoose.model<IQuery>('Query', QuerySchema);
