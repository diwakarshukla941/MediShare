import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

async function run() {
  await connectDB();
  const videos = await mongoose.connection.collection("videos").updateMany({}, { $unset: { email: "" } });
  const templates = await mongoose.connection.collection("contenttemplates").deleteMany({ targetType: "doctor" });
  console.log(`Removed doctor email from ${videos.modifiedCount} video(s) and ${templates.deletedCount} legacy template(s).`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Legacy doctor-email cleanup failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
