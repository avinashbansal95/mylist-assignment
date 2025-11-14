import mongoose from "mongoose";
import config from "../config";

export async function connectMongoose() {
  const uri = config.mongoUri;
  if (!uri) throw new Error("MONGO_URI not set");

  await mongoose.connect(uri, {
    // options if needed (Mongoose v7 auto handles many)
  });
  console.log("MongoDB connected");
}
