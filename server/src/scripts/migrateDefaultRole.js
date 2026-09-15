import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Admin } from "../models/Admin.js";
import { Role } from "../models/Role.js";

const DEFAULT_ROLE_NAME = "Admin (Full Access)";
const DEFAULT_PERMISSIONS = ["videos:view", "videos:upload", "analytics:view"];

async function migrate() {
  await connectDB();

  let role = await Role.findOne({ name: DEFAULT_ROLE_NAME });
  if (!role) {
    role = await Role.create({ name: DEFAULT_ROLE_NAME, permissions: DEFAULT_PERMISSIONS });
    console.log(`Created role "${role.name}"`);
  }

  // Raw legacy documents may be missing the role/roleId fields entirely (only
  // applied as Mongoose defaults on read) — fetch and filter in JS rather
  // than relying on a query to match an absent field.
  const admins = await Admin.find({});
  let backfilled = 0;
  for (const admin of admins) {
    if (admin.role !== "super_admin" && !admin.roleId) {
      admin.roleId = role._id;
      await admin.save();
      backfilled += 1;
    }
  }
  console.log(`Backfilled ${backfilled} existing admin account(s) onto "${role.name}"`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
