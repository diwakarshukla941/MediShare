import { getContainer } from "@cloudflare/containers";
export { MediShareApiContainer } from "./container.js";

const containerFor = (env) => getContainer(env.MEDISHARE_API, "medishare-api-production");

async function renderVideo(env, videoId) {
  const response = await containerFor(env).fetch(new Request("http://container/_internal/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-render-secret": env.JWT_SECRET },
    body: JSON.stringify({ videoId }),
  }));
  if (!response.ok) throw new Error(`Render service returned HTTP ${response.status}`);
  return response.json();
}

async function enqueueResponseRender(request, env, response) {
  if (!response.ok || !env.VIDEO_RENDER_QUEUE) return response;
  const url = new URL(request.url);
  const isUploadCompletion = request.method === "POST" && url.pathname === "/api/videos/complete-upload";
  const isVideoUpdate = request.method === "PATCH" && /^\/api\/videos\/[^/]+$/.test(url.pathname);
  if (!isUploadCompletion && !isVideoUpdate) return response;
  try {
    const data = await response.clone().json();
    const video = data.video;
    if (video?.renderingStatus === "processing") await env.VIDEO_RENDER_QUEUE.send({ videoId: video._id });
  } catch (error) {
    // Queue publication is best-effort here so a successful R2 upload remains
    // usable. Queue delivery itself is durable once Cloudflare accepts it.
    console.error("Could not enqueue video render immediately:", error.message);
  }
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ service: "medishare-api-gateway", status: "ok" });
    }
    if (url.pathname.startsWith("/_internal/")) return new Response("Not found", { status: 404 });
    const response = await containerFor(env).fetch(request);
    return enqueueResponseRender(request, env, response);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await renderVideo(env, String(message.body?.videoId || ""));
        message.ack();
      } catch (error) {
        console.error("Video render queue item failed:", error.message);
        message.retry({ delaySeconds: 30 });
      }
    }
  },
};
