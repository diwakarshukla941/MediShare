import { Router } from "express";
import {
  createVideo,
  bulkCreateVideos,
  getSampleCsv,
  listVideos,
  getPublicVideo,
  updateVideo,
  deleteVideo,
  incrementShare,
  getStats,
  trackWatch,
  getFramedDownload,
  getVideo,
} from "../controllers/video.controller.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { uploadSingleVideo, uploadBulk } from "../middleware/upload.middleware.js";
import { publicUploadLimiter, trackLimiter, downloadLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Public (no auth) — also used by the dashboard's single-upload page, which
// sends a Bearer token so optionalAuth can tag the video with source "dashboard"
router.post("/", publicUploadLimiter, optionalAuth, uploadSingleVideo, createVideo);
router.get("/public/:slug", getPublicVideo);
router.post("/:id/share", incrementShare);
router.post("/:id/track-watch", trackLimiter, trackWatch);
router.post("/:id/download", downloadLimiter, getFramedDownload);
router.get("/stats", requireAuth, getStats);
router.get("/sample-csv", requireAuth, getSampleCsv);

// Dashboard (auth required)
router.get("/", requireAuth, listVideos);
router.post("/bulk", requireAuth, uploadBulk, bulkCreateVideos);
router.get("/:id", requireAuth, getVideo);
router.patch("/:id", requireAuth, updateVideo);
router.delete("/:id", requireAuth, deleteVideo);

export default router;
