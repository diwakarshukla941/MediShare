import { Router } from "express";
import { getStorageConfig, updateStorageConfig } from "../controllers/storageConfig.controller.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);
router.get("/", getStorageConfig);
router.put("/", updateStorageConfig);
export default router;
