import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  icon: string;
  queries: string[];
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true },
  icon: { type: String, required: true },
  queries: [{ type: String, required: true }],
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
