import app from "./server";
import config from "./config";
import { connectMongoose } from "./db/mongoose";
import { getRedis } from "./db/redis";

async function bootstrap() {
  try {
    await connectMongoose();
    // Init redis connection
    const redis = getRedis();
    // optionally ping if redis is enabled and supports ping
    if (redis && typeof (redis as any).ping === "function") {
      try {
        await (redis as any).ping();
      } catch (err) {
        console.warn("Redis ping failed:", err);
      }
    }

    app.listen(config.port, () => {
      console.log(`Server listening on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

bootstrap();
