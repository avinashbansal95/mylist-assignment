import { Request, Response } from "express";
import { User } from "../models/User";
import { Movie } from "../models/Movie";
import { TvShow } from "../models/TvShow";

export class ContentController {
  async createUser(req: Request, res: Response) {
    const { username, email } = req.body;
    if (!username || !email) return res.status(400).json({ error: "username and email required" });
    try {
      const u = await User.create({ username, email });
      return res.status(201).json(u);
    } catch (err: any) {
      if (err.code === 11000) return res.status(409).json({ error: "duplicate" });
      console.error(err);
      return res.status(500).json({ error: "internal" });
    }
  }

  async createMovie(req: Request, res: Response) {
    const { title, year, genres } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    try {
      const m = await Movie.create({ title, year, genres });
      return res.status(201).json(m);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal" });
    }
  }

  async createTvShow(req: Request, res: Response) {
    const { title, seasons, genres } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    try {
      const t = await TvShow.create({ title, seasons, genres });
      return res.status(201).json(t);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal" });
    }
  }
}
