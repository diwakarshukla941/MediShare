import { api } from "./api.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Wait for Cloudflare's background render without turning short network
// interruptions into a failed upload/download. The render status endpoint is
// intentionally lightweight and does not consume the download rate limit.
export async function waitForVideoRender(slug, onStatus) {
  if (!slug) return;
  let delay = 2500;
  while (true) {
    try {
      const { data } = await api.get(`/videos/public/${slug}/status`);
      delay = 2500;

      if (data.renderingStatus === "completed") return data;
      if (data.renderingStatus === "failed") {
        const error = new Error(data.renderingError || "The framed video could not be prepared. The original upload is safe.");
        error.code = "VIDEO_RENDER_FAILED";
        throw error;
      }

      onStatus?.("Your upload is saved. We’re preparing the framed video now; it will be ready automatically.");
    } catch (error) {
      if (error.code === "VIDEO_RENDER_FAILED") throw error;
      const status = error?.response?.status;
      if (status && status < 500 && status !== 429) throw error;
      onStatus?.("Reconnecting to check video processing. Your uploaded file is safe.");
      delay = Math.min(Math.round(delay * 1.5), 15000);
    }

    await wait(delay);
  }
}
