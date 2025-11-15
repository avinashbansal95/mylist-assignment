// run with: npx ts-node src/scripts/seed.ts OR add npm run seed
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import config from "../config";
import { User, IUser } from "../models/User";
import { Movie, IMovie } from "../models/Movie";
import { TvShow, ITvShow } from "../models/TvShow";
import { ListItem } from "../models/ListItem";

async function main() {
  const uri = config.mongoUri || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set");

  await mongoose.connect(uri);
  console.log("Connected to Mongo");

  // Create a test user
  const username = "seed-user";
  let user = await User.findOne({ username }) as IUser;
  if (!user) {
    user = await User.create({ username, email: "seed_user@example.com" }) as IUser;
    console.log("Created user:", user._id);
  } else {
    console.log("Using existing user:", user._id);
  }

  // Create N movies and tv shows
  const moviesCount = 50;
  const tvCount = 20;

  const movies: IMovie[] = [];
  for (let i = 1; i <= moviesCount; i++) {
    const title = `Seed Movie ${i}`;
    const m = await Movie.create({ title, year: 2000 + (i % 20), genres: ["drama"] });
    movies.push(m);
  }
  console.log(`Created ${movies.length} movies`);

  const tvs: ITvShow[] = [];
  for (let i = 1; i <= tvCount; i++) {
    const title = `Seed TV ${i}`;
    const t = await TvShow.create({ title, seasons: 1 + (i % 5), genres: ["comedy"] });
    tvs.push(t);
  }
  console.log(`Created ${tvs.length} tv shows`);

  // Populate user's MyList with first 30 movies & tvs mixed (newest first)
  const itemsToAdd = 30;
  const mixed: (IMovie | ITvShow)[] = [...movies.slice(0, 20), ...tvs.slice(0, 10)];

  // create ListItem entries (newest first -> push with createdAt now minus index)
  for (let i = 0; i < itemsToAdd; i++) {
    const item = mixed[i % mixed.length];
    // Use property check instead of instanceof
    const contentType = (item as IMovie).year !== undefined ? "movie" : "tvshow";
    // create with createdAt offset so ordering is deterministic
    const doc = new ListItem({
      userId: (user._id as any).toString(),
      contentId: (item._id as any).toString(),
      contentType,
      createdAt: new Date(Date.now() - i * 1000) // staggered
    });
    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        // already exists
      } else {
        console.error("save err", err);
      }
    }
  }
  console.log(`Seeded ${itemsToAdd} items into ${user.username}'s list`);

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
