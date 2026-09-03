import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import videoRoutes from "./routes/video.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import frameRoutes from "./routes/frame.routes.js";
import contentTemplateRoutes from "./routes/contentTemplate.routes.js";
import adminUserRoutes from "./routes/adminUser.routes.js";
import roleRoutes from "./routes/role.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.get("/api/health", (req, res) => res.json({ status: "ok", environment: process.env.APP_ENV || "development" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/videos", videoRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/frames", frameRoutes);
  app.use("/api/content-templates", contentTemplateRoutes);
  app.use("/api/admins", adminUserRoutes);
  app.use("/api/roles", roleRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
