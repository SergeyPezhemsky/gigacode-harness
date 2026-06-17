import express from "express";
import cors from "cors";
import path from "node:path";
import { clientDist } from "./config.js";
import { createApiRouter } from "./routes/api.js";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter());

  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  return app;
}
