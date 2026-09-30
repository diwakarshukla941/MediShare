import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

async function run() {
  await connectDB();
  await mongoose.connection.collection("zones").updateOne(
    { name: "Not assigned" },
    { $setOnInsert: { name: "Not assigned", createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
  const result = await mongoose.connection.collection("videos").updateMany(
    {},
    [
      {
        $set: {
          credentials: { $ifNull: ["$credentials", "$degree"] },
          empId: { $ifNull: ["$empId", "Not assigned"] },
          zone: { $ifNull: ["$zone", "Not assigned"] },
        },
      },
      { $unset: ["degree", "designation", "specialization", "organizationName", "email"] },
    ]
  );
  console.log(`Migrated ${result.modifiedCount} video record(s) to Phase 1 fields.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Phase 1 migration failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
