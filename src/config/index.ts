import dotenv from "dotenv";
dotenv.config();

export default {
  port: process.env.PORT || 4000,

  mongoUri: process.env.MONGO_URI || "",

  redisUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  cacheTTL: Number(process.env.REDIS_CACHE_TTL_SECONDS || 30),
};
