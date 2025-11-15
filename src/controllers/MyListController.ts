import { Request, Response } from "express";
import { MyListService } from "../services/MyListService";

export class MyListController {
  service: MyListService;

  constructor(service: MyListService) {
    this.service = service;
    // bind methods if you prefer passing directly to routes
    this.list = this.list.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
  }

  private getUserId(req: Request): string | null {
    // replace with real auth in prod
    return (req.headers["x-user-id"] as string) || (req.query.userId as string) || null;
  }

  async list(req: Request, res: Response) {
    const userId = this.getUserId(req);
    if (!userId) return res.status(400).json({ error: "missing user id" });

    const limit = Number(req.query.limit || 25);
    const cursor = req.query.cursor as string | undefined;

    try {
      const result = await this.service.list(userId, limit, cursor);
      return res.json({ source: result.source, ...result.payload });
    } catch (err) {
      console.error("list error", err);
      return res.status(500).json({ error: "internal" });
    }
  }

  async add(req: Request, res: Response) {
    const userId = this.getUserId(req);
    if (!userId) return res.status(400).json({ error: "missing user id" });
    const { contentId, contentType } = req.body;
    if (!contentId || !contentType) return res.status(400).json({ error: "missing fields" });

    try {
      const item = await this.service.add(userId, contentId, contentType);
      return res.status(201).json({ ok: true, item });
    } catch (err: any) {
      if (err.code === 11000) return res.status(409).json({ error: "already exists" });
      console.error("add error", err);
      return res.status(500).json({ error: "internal" });
    }
  }

  async remove(req: Request, res: Response) {
    const userId = this.getUserId(req);
    if (!userId) return res.status(400).json({ error: "missing user id" });
    const contentId = req.params.itemId || req.body.contentId;
    if (!contentId) return res.status(400).json({ error: "missing contentId" });

    try {
      const deleted = await this.service.remove(userId, contentId);
      return res.json({ ok: true, deleted });
    } catch (err) {
      console.error("remove error", err);
      return res.status(500).json({ error: "internal" });
    }
  }
}
