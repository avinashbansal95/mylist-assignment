import { Request, Response } from "express";
import { User } from "../models/User";
import { getRedisClient } from "../db/redis";
import config from "../config";

const USERS_CACHE_KEY = "users:all";

export async function createUser(req: Request, res: Response) {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "name and email required" });

    const user = await User.create({ name, email });

    // clear cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(USERS_CACHE_KEY);
    }

    return res.status(201).json(user);
  } catch (err: any) {
    console.error(err);
    if (err.code === 11000)
      return res.status(409).json({ error: "email already exists" });

    return res.status(500).json({ error: "internal error" });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const redis = getRedisClient();

    if (redis) {
      const cached = await redis.get(USERS_CACHE_KEY);
      if (cached) {
        console.log("got from cache")
        return res.json({ source: "cache", data: cached });
      }
    }

    const users = await User.find().sort({ createdAt: -1 }).lean();

    if (redis) {
      await redis.set(
        USERS_CACHE_KEY,
        users,
        { ex: config.cacheTTL } // TTL
      );
    }
     console.log("not from cache")
    return res.json({ source: "db", data: users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
}
