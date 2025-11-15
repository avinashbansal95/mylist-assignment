import mongoose from "mongoose";
import config from "../config";

export async function connectMongoose() {
  // Prefer environment variable for CI/tests
  const uri = process.env.MONGO_URI || config.mongoUri;

  if (!uri) {
    throw new Error("No MongoDB URI found in process.env.MONGO_URI or config.mongoUri");
  }

  await mongoose.connect(uri);
  console.log("MongoDB connected:", uri);
}
