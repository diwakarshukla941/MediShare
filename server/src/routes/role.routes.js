import { Router } from "express";
import {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/role.controller.js";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requirePermission("team:manage"));

router.get("/permissions", listPermissions);
router.get("/", listRoles);
router.post("/", createRole);
router.patch("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
