import { Redis } from "@upstash/redis";
import config from "../config";

let client: Redis | null = null;

export function getRedis() {
  if (!client) {
    if (!config.redisUrl || !config.redisToken) return null;
    client = new Redis({ url: config.redisUrl, token: config.redisToken });
  }
  return client;
}

export function versionKeyForUser(userId: string) {
  return `mylist:${userId}:version`;
}
export function pageKey(userId: string, cursorKey: string, version: number) {
  return `mylist:${userId}:page:${cursorKey}:v${version}`;
}
export function lockKey(userId: string, cursorKey: string) {
  return `mylist:lock:${userId}:${cursorKey}`;
}
