import { z } from "zod";
import { PERMISSION_KEYS } from "../constants/permissions.js";

const permissionOverridesSchema = z
  .object({
    add: z.array(z.enum(PERMISSION_KEYS)).default([]),
    remove: z.array(z.enum(PERMISSION_KEYS)).default([]),
  })
  .optional();

export const createAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  location: z.string().trim().default(""),
  role: z.enum(["admin", "super_admin"]).default("admin"),
  roleId: z.string().trim().length(24).nullable().optional(),
  permissionOverrides: permissionOverridesSchema,
});

export const updateAdminSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    location: z.string().trim().optional(),
    role: z.enum(["admin", "super_admin"]).optional(),
    roleId: z.string().trim().length(24).nullable().optional(),
    permissionOverrides: permissionOverridesSchema,
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });
