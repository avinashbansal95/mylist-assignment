import { Schema, model, Document } from "mongoose";

export type ContentType = "movie" | "tvshow" | "other";

export interface IListItem extends Document {
  userId: string;
  contentId: string;
  contentType: ContentType;
  createdAt: Date;
}

const ListItemSchema = new Schema<IListItem>(
  {
    userId: { type: String, required: true, index: true },
    contentId: { type: String, required: true },
    contentType: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ListItemSchema.index({ userId: 1, contentId: 1 }, { unique: true });
ListItemSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export const ListItem = model<IListItem>("ListItem", ListItemSchema);
