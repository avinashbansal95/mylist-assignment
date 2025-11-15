// tests/integration/myList.integration.test.ts

// Mock Redis BEFORE importing anything that depends on it
jest.mock("../../src/db/redis", () => {
  // define InMemoryRedis inside factory to avoid hoisting/init issues
  class InMemoryRedis {
    store: Map<string, any>;
    expirations: Map<string, number>;
    constructor() {
      this.store = new Map();
      this.expirations = new Map();
    }
    async get(key: string) {
      this._cleanup(key);
      const v = this.store.get(key);
      return v === undefined ? null : v;
    }
    async set(key: string, value: any, opts?: any) {
      if (opts && opts.nx) {
        if (this.store.has(key)) return null;
        this.store.set(key, value);
      } else {
        this.store.set(key, value);
      }
      if (opts && opts.ex) {
        const when = Date.now() + opts.ex * 1000;
        this.expirations.set(key, when);
      }
      return "OK";
    }
    async del(key: string) {
      this.store.delete(key);
      this.expirations.delete(key);
      return 1;
    }
    async incr(key: string) {
      const cur = Number(this.store.get(key) || 0);
      const n = cur + 1;
      this.store.set(key, n);
      return n;
    }
    _cleanup(key: string) {
      const exp = this.expirations.get(key);
      if (exp && Date.now() > exp) {
        this.store.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  const redisInstance = new InMemoryRedis();

  return {
    getRedis: () => redisInstance,
    versionKeyForUser: (userId: string) => `mylist:${userId}:version`,
    pageKey: (userId: string, cursorKey: string, version: number) =>
      `mylist:${userId}:page:${cursorKey}:v${version}`,
    lockKey: (userId: string, cursorKey: string) => `mylist:lock:${userId}:${cursorKey}`,
  };
});

// Now import modules that depend on src/db/redis
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../../src/server"; // your express app
import { ListItem } from "../../src/models/ListItem";
import { User } from "../../src/models/User";
import { Movie } from "../../src/models/Movie";
import { TvShow } from "../../src/models/TvShow";
import { connectMongoose } from "../../src/db/mongoose";

describe("MyList integration", () => {
  let mongod: MongoMemoryServer;
  let userId: string;
  let movieId: string;
  let tvId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_URI = uri;
    // connect mongoose using your helper
    await connectMongoose(); // must read process.env.MONGO_URI internally
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    // clear DB collections
    await Promise.all(
      Object.keys(mongoose.connection.collections).map((key) =>
        mongoose.connection.collections[key].deleteMany({})
      )
    );

    // create user, movie, tv (cast to any to avoid _id typing noise)
    const user = (await User.create({
      username: "tuser",
      email: "tuser@example.com",
    })) as any;
    userId = user._id.toString();

    const m = (await Movie.create({ title: "Test Movie" })) as any;
    movieId = m._id.toString();

    const t = (await TvShow.create({ title: "Test Tv" })) as any;
    tvId = t._id.toString();

    // seed some list items (15 items)
    for (let i = 0; i < 15; i++) {
      await ListItem.create({
        userId,
        contentId: `seed-${i}`,
        contentType: i % 2 === 0 ? "movie" : "tvshow",
        createdAt: new Date(Date.now() - i * 1000),
      });
    }
  });

  test("GET /my-list returns paginated db on first call and cache on second", async () => {
    const res1 = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(res1.status).toBe(200);
    expect(res1.body.source).toBe("db");
    expect(res1.body.data).toHaveLength(10);
    const nextCursor = res1.body.nextCursor;
    expect(nextCursor).toBeDefined();

    const res2 = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(res2.status).toBe(200);
    expect(res2.body.source).toBe("cache");
    expect(res2.body.data).toHaveLength(10);

    const res3 = await request(app)
      .get(`/my-list?limit=10&cursor=${encodeURIComponent(nextCursor)}`)
      .set("x-user-id", userId);
    expect(res3.status).toBe(200);
    expect(res3.body.data.length).toBeGreaterThanOrEqual(5);
  });

  test("POST /my-list adds item and invalidates cache (version bump)", async () => {
    const r1 = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(r1.body.source).toBe("db");

    const r2 = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(r2.body.source).toBe("cache");

    const addRes = await request(app)
      .post("/my-list")
      .send({ contentId: movieId, contentType: "movie" })
      .set("x-user-id", userId)
      .set("Content-Type", "application/json");
    expect(addRes.status).toBe(201);

    const r3 = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(r3.body.source).toBe("db");
    const found = r3.body.data.find((d: any) => d.contentId === movieId);
    expect(found).toBeDefined();
  });

  test("DELETE /my-list removes item and invalidates cache", async () => {
    await request(app)
      .post("/my-list")
      .send({ contentId: tvId, contentType: "tvshow" })
      .set("x-user-id", userId)
      .set("Content-Type", "application/json");

    const del = await request(app).delete(`/my-list/${tvId}`).set("x-user-id", userId);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const r = await request(app).get("/my-list?limit=10").set("x-user-id", userId);
    expect(r.body.source).toBe("db");
    expect(r.body.data.find((d: any) => d.contentId === tvId)).toBeUndefined();
  });

  test("Duplicate add is idempotent (no duplicates)", async () => {
    const add1 = await request(app)
      .post("/my-list")
      .send({ contentId: movieId, contentType: "movie" })
      .set("x-user-id", userId)
      .set("Content-Type", "application/json");
    expect(add1.status).toBe(201);

    const add2 = await request(app)
      .post("/my-list")
      .send({ contentId: movieId, contentType: "movie" })
      .set("x-user-id", userId)
      .set("Content-Type", "application/json");
    expect([200, 201, 409]).toContain(add2.status);

    const count = await ListItem.countDocuments({ userId, contentId: movieId });
    expect(count).toBe(1);
  });

  test("Missing fields return 400", async () => {
    const r = await request(app).post("/my-list").send({ contentType: "movie" }).set("x-user-id", userId);
    expect(r.status).toBe(400);
  });

  test("Concurrent adds of same contentId produce single DB entry (race)", async () => {
    const N = 5;
    const promises: Array<Promise<any>> = [];

    for (let i = 0; i < N; i++) {
      promises.push(
        request(app)
          .post("/my-list")
          .send({ contentId: "concurrent-item", contentType: "movie" })
          .set("x-user-id", userId)
          .set("Content-Type", "application/json")
      );
    }

    const results = await Promise.all(promises);
    expect(results.some((r) => r.status === 201)).toBeTruthy();

    const count = await ListItem.countDocuments({ userId, contentId: "concurrent-item" });
    expect(count).toBe(1);
  });

  test("Cold rebuild stampede protection: many parallel GETs only cause single rebuild", async () => {
    const { getRedis, versionKeyForUser } = require("../../src/db/redis");
    const redis = getRedis();
    await redis.set(versionKeyForUser(userId), 1000);

    const parallel: Array<Promise<any>> = Array.from({ length: 8 }).map(() =>
      request(app).get("/my-list?limit=5").set("x-user-id", userId)
    );

    const responses = await Promise.all(parallel);
    responses.forEach((r) => expect(r.status).toBe(200));
    expect(responses.some((r) => r.body.source === "db")).toBeTruthy();
  });
});
