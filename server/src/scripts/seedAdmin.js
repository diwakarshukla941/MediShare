import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Admin } from "../models/Admin.js";

async function seed() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before seeding");
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const email = ADMIN_EMAIL.toLowerCase();
  const role = ADMIN_ROLE === "super_admin" ? "super_admin" : "admin";

  const admin = await Admin.findOneAndUpdate(
    { email },
    { name: ADMIN_NAME || "Admin", email, passwordHash, role, isActive: true },
    { upsert: true, new: true }
  );

  console.log(`Admin account ready: ${admin.email} (${admin.role})`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
