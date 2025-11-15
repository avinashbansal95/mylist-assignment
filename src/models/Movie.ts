import { Schema, model, Document } from "mongoose";

export interface IMovie extends Document {
  title: string;
  year?: number;
  genres?: string[];
  meta?: Record<string, any>;
  createdAt: Date;
}

const MovieSchema = new Schema<IMovie>(
  {
    title: { type: String, required: true, index: true },
    year: { type: Number },
    genres: { type: [String], default: [] },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Movie = model<IMovie>("Movie", MovieSchema);
