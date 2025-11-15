import { Schema, model, Document } from "mongoose";

export interface ITvShow extends Document {
  title: string;
  seasons?: number;
  genres?: string[];
  createdAt: Date;
}

const TvShowSchema = new Schema<ITvShow>(
  {
    title: { type: String, required: true, index: true },
    seasons: { type: Number },
    genres: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TvShow = model<ITvShow>("TvShow", TvShowSchema);
