import { Redis } from "@upstash/redis";
import config from "../config";

let client: Redis | null = null;

export function getRedisClient() {
  if (!client) {
    if (!config.redisUrl || !config.redisToken) {
      console.warn("REDIS_URL or REDIS_TOKEN not set. Redis disabled.");
      return null;
    }

    client = new Redis({
      url: config.redisUrl,
      token: config.redisToken,
    });

    console.log("Upstash Redis initialized");
  }

  return client;
}
