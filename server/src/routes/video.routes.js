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
import { requireAuth, optionalAuth, requirePermission } from "../middleware/auth.middleware.js";
import { uploadSingleVideo, uploadBulk } from "../middleware/upload.middleware.js";
import { publicUploadLimiter, trackLimiter, downloadLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Public (no auth) — also used by the dashboard's single-upload page, which
// sends a Bearer token so optionalAuth can tag the video with source "dashboard"
// (requirePermission no-ops for anonymous/public requests, only gates logged-in admins)
router.post("/", publicUploadLimiter, optionalAuth, requirePermission("videos:upload"), uploadSingleVideo, createVideo);
router.get("/public/:slug", getPublicVideo);
router.post("/:id/share", incrementShare);
router.post("/:id/track-watch", trackLimiter, trackWatch);
router.post("/:id/download", downloadLimiter, getFramedDownload);
router.get("/stats", requireAuth, requirePermission("videos:view"), getStats);
router.get("/sample-csv", requireAuth, requirePermission("videos:bulk_upload"), getSampleCsv);

// Dashboard (auth required)
router.get("/", requireAuth, requirePermission("videos:view"), listVideos);
router.post("/bulk", requireAuth, requirePermission("videos:bulk_upload"), uploadBulk, bulkCreateVideos);
router.get("/:id", requireAuth, requirePermission("videos:view"), getVideo);
router.patch("/:id", requireAuth, requirePermission("videos:view"), updateVideo);
router.delete("/:id", requireAuth, requirePermission("videos:view"), deleteVideo);

export default router;
