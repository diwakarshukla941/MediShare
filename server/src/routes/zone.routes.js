import { Router } from "express";
import { createZone, deleteZone, listZones, updateZone } from "../controllers/zone.controller.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", listZones);
router.use(requireAuth, requireSuperAdmin);
router.post("/", createZone);
router.patch("/:id", updateZone);
router.delete("/:id", deleteZone);

export default router;
