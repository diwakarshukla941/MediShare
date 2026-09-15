import { Router } from "express";
import { listTemplates, upsertDefaultTemplate } from "../controllers/contentTemplate.controller.js";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth, requirePermission("content_templates:manage"));
router.get("/", listTemplates);
router.put("/default", upsertDefaultTemplate);

export default router;
