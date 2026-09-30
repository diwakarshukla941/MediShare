import "dotenv/config";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { resumeProcessingVideos } from "./controllers/video.controller.js";

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    const resumed = await resumeProcessingVideos();
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`MediShare API running on http://localhost:${PORT}`);
      if (resumed) console.log(`Resumed ${resumed} unfinished video render job(s)`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
