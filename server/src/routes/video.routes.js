import { Router } from "express";
import {
  createVideo,
  bulkCreateVideos,
  getSampleCsv,
  exportVideos,
  listVideos,
  getPublicVideo,
  getPublicVideoStatus,
  updateVideo,
  deleteVideo,
  bulkDeleteVideos,
  incrementShare,
  getStats,
  trackWatch,
  getFramedDownload,
  getVideo,
} from "../controllers/video.controller.js";
import { requireAuth, optionalAuth, requirePermission, requireSuperAdmin } from "../middleware/auth.middleware.js";
import { uploadSingleVideo, uploadBulk } from "../middleware/upload.middleware.js";
import { publicUploadLimiter, trackLimiter, downloadLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Public (no auth) — also used by the dashboard's single-upload page, which
// sends a Bearer token so optionalAuth can tag the video with source "dashboard"
// (requirePermission no-ops for anonymous/public requests, only gates logged-in admins)
router.post("/", publicUploadLimiter, optionalAuth, requirePermission("videos:upload"), uploadSingleVideo, createVideo);
router.get("/public/:slug/status", getPublicVideoStatus);
router.get("/public/:slug", getPublicVideo);
router.post("/:id/share", incrementShare);
router.post("/:id/track-watch", trackLimiter, trackWatch);
router.get("/:id/download", downloadLimiter, getFramedDownload);
router.get("/stats", requireAuth, requirePermission("videos:view"), getStats);
router.get("/sample-csv", requireAuth, requireSuperAdmin, getSampleCsv);
router.get("/export", requireAuth, requirePermission("videos:view"), exportVideos);

// Dashboard (auth required)
router.get("/", requireAuth, requirePermission("videos:view"), listVideos);
router.post("/bulk", requireAuth, requireSuperAdmin, uploadBulk, bulkCreateVideos);
router.delete("/bulk", requireAuth, requireSuperAdmin, bulkDeleteVideos);
router.get("/:id", requireAuth, requirePermission("videos:view"), getVideo);
router.patch("/:id", requireAuth, requirePermission("videos:view"), updateVideo);
router.delete("/:id", requireAuth, requirePermission("videos:view"), deleteVideo);

export default router;
