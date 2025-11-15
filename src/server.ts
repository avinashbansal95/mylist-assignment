// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import myListRouter from "./routes/myList";
import contentRouter from "./routes/content";

const app = express();

// Security headers
app.use(helmet());

// CORS - allow all (for development). In prod restrict origins.
app.use(cors());

// Logging
// use 'dev' for local dev, 'combined' for prod
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat));

// Body parser (built-in)
app.use(express.json());

// health
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true, now: Date.now() }));

// Mount routers
app.use("/api", contentRouter);
app.use("/my-list", myListRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// Basic error handler
/* eslint-disable @typescript-eslint/no-unused-vars */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});
/* eslint-enable @typescript-eslint/no-unused-vars */

export default app;
