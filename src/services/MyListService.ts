import { ListItem, IListItem } from "../models/ListItem";
import { getRedis, versionKeyForUser, pageKey, lockKey } from "../db/redis";
import mongoose from "mongoose";

type PagePayload = { data: any[]; nextCursor: string | null; count: number; limit?: number };

const DEFAULT_LIMIT = 25;
const PAGE_TTL = 60 * 10; // 10 minutes

function makeCursorFrom(doc: any) {
  return Buffer.from(`${doc.createdAt.getTime()}:${doc._id}`).toString("base64");
}
function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const s = Buffer.from(cursor, "base64").toString("utf8");
    const [ts, id] = s.split(":");
    return { createdAt: new Date(Number(ts)), id };
  } catch {
    return null;
  }
}

export class MyListService {
  redis = getRedis();

  private cursorKeyFrom(cursor?: string) {
    return cursor ? cursor : "start";
  }

  private async getVersion(userId: string) {
    if (!this.redis) return 0;
    const v = await this.redis.get(versionKeyForUser(userId));
    return v ? Number(v) : 0;
  }

  private async bumpVersion(userId: string) {
    if (!this.redis) return;
    await this.redis.incr(versionKeyForUser(userId));
  }

  // list (tries cache, else DB)
  async list(userId: string, limit = DEFAULT_LIMIT, cursor?: string): Promise<{ source: "cache"|"db"; payload: PagePayload }> {
    limit = Math.min(limit, 100);
    const cursorKey = this.cursorKeyFrom(cursor);
    const version = await this.getVersion(userId);
    const pk = pageKey(userId, cursorKey, version);

    // try cache
    if (this.redis) {
      const cached = await this.redis.get(pk);
      if (cached) return { source: "cache", payload: cached as PagePayload };
    }

    // try to acquire short lock to prevent stampede
    const lock = lockKey(userId, cursorKey);
    let gotLock = false;
    if (this.redis) {
      const r = await this.redis.set(lock, "1", { nx: true, ex: 3 });
      gotLock = Boolean(r);
    }

    if (!gotLock) {
      // wait briefly then try cache again
      await new Promise((r) => setTimeout(r, 150));
      if (this.redis) {
        const cached2 = await this.redis.get(pk);
        if (cached2) return { source: "cache", payload: cached2 as PagePayload };
      }
      // fallback to DB read
    }

    // build DB query for cursor pagination
    const decoded = decodeCursor(cursor);
    const filter: any = { userId };
    if (decoded) {
      filter.$or = [
        { createdAt: { $lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } },
      ];
    }

    const docs = await ListItem.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    let nextCursor: string | null = null;
    if (docs.length > limit) {
      const last = docs[limit - 1];
      nextCursor = makeCursorFrom(last);
      docs.splice(limit);
    }

    const payload: PagePayload = { data: docs, nextCursor, count: docs.length, limit };

    // write cache (best-effort)
    if (this.redis) {
      await this.redis.set(pk, payload, { ex: PAGE_TTL });
      try { await this.redis.del(lock); } catch {}
    }

    return { source: "db", payload };
  }

  // add item: idempotent, upsert
  async add(userId: string, contentId: string, contentType: string) {
    const upsert = await ListItem.findOneAndUpdate(
      { userId, contentId },
      { $setOnInsert: { userId, contentId, contentType } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // bump version to invalidate caches
    await this.bumpVersion(userId);

    // optimistic update for first page
   // optimistic update for first page
    if (this.redis) {
        const ver = await this.getVersion(userId);
        const pk = pageKey(userId, "start", ver);

        const cached = (await this.redis.get(pk)) as PagePayload | null;

        if (cached) {
            const arr = cached.data || [];
            const newDoc = {
            _id: upsert._id,
            createdAt: upsert.createdAt,
            contentId: upsert.contentId,
            contentType: upsert.contentType,
            userId: upsert.userId,
            };

            arr.unshift(newDoc);

            if (arr.length > (cached.limit || DEFAULT_LIMIT)) arr.pop();

            await this.redis.set(pk, { ...cached, data: arr }, { ex: PAGE_TTL });
        }
    }
    return upsert;
  }

  // remove item
  async remove(userId: string, contentId: string) {
    const doc = await ListItem.findOneAndDelete({ userId, contentId });
    await this.bumpVersion(userId);
    return !!doc;
  }
}
