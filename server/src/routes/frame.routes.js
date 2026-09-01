import { Router } from "express";
import {
  listFrames,
  getFrame,
  getActiveFrameHandler,
  createFrame,
  updateFrame,
  duplicateFrame,
  deleteFrame,
  activateFrame,
  uploadFrameAsset,
} from "../controllers/frame.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadFrameImage } from "../middleware/upload.middleware.js";

const router = Router();

// Public — the watch page needs the currently active frame with no auth
router.get("/active", getActiveFrameHandler);

// Everything else is the (unlisted-URL) Frame Studio — protected like other admin routes
router.get("/", requireAuth, listFrames);
router.post("/", requireAuth, createFrame);
router.post("/assets", requireAuth, uploadFrameImage, uploadFrameAsset);
router.get("/:id", requireAuth, getFrame);
router.patch("/:id", requireAuth, updateFrame);
router.delete("/:id", requireAuth, deleteFrame);
router.post("/:id/duplicate", requireAuth, duplicateFrame);
router.post("/:id/activate", requireAuth, activateFrame);

export default router;
