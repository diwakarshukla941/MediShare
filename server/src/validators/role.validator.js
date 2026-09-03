import { z } from "zod";
import { PERMISSION_KEYS } from "../constants/permissions.js";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  permissions: z.array(z.enum(PERMISSION_KEYS)).default([]),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    permissions: z.array(z.enum(PERMISSION_KEYS)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });
