import { Router } from "express";
import { getAnalytics } from "../controllers/analytics.controller.js";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requirePermission("analytics:view"), getAnalytics);

export default router;
