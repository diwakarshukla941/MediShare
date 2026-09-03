import { Router } from "express";
import {
  listTemplates,
  upsertDefaultTemplate,
  createDoctorTemplate,
  updateDoctorTemplate,
  deleteDoctorTemplate,
} from "../controllers/contentTemplate.controller.js";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requirePermission("content_templates:manage"));

router.get("/", listTemplates);
router.put("/default", upsertDefaultTemplate);
router.post("/doctor", createDoctorTemplate);
router.patch("/doctor/:id", updateDoctorTemplate);
router.delete("/doctor/:id", deleteDoctorTemplate);

export default router;
