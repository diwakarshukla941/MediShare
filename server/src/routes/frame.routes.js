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
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";
import { uploadFrameImage } from "../middleware/upload.middleware.js";

const router = Router();

// Public — the watch page needs the currently active frame with no auth
router.get("/active", getActiveFrameHandler);

// Everything else is the (unlisted-URL) Frame Studio — protected like other admin routes
router.use(requireAuth, requirePermission("frames:manage"));
router.get("/", listFrames);
router.post("/", createFrame);
router.post("/assets", uploadFrameImage, uploadFrameAsset);
router.get("/:id", getFrame);
router.patch("/:id", updateFrame);
router.delete("/:id", deleteFrame);
router.post("/:id/duplicate", duplicateFrame);
router.post("/:id/activate", activateFrame);

export default router;
