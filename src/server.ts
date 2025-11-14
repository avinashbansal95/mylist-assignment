import express from "express";
import usersRouter from "./routes/users";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true, timestamp: Date.now() }));

app.use("/users", usersRouter);

export default app;
