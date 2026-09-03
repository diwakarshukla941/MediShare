import { Router } from "express";
import {
  listAdmins,
  createAdmin,
  bulkCreateAdmins,
  getSampleAdminSheet,
  updateAdmin,
  deleteAdmin,
} from "../controllers/adminUser.controller.js";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";
import { uploadSheet } from "../middleware/upload.middleware.js";

const router = Router();

router.use(requireAuth, requirePermission("team:manage"));

router.get("/", listAdmins);
router.post("/", createAdmin);
router.post("/bulk", uploadSheet, bulkCreateAdmins);
router.get("/sample-csv", getSampleAdminSheet);
router.patch("/:id", updateAdmin);
router.delete("/:id", deleteAdmin);

export default router;
