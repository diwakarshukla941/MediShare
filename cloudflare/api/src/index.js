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

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function enqueueRenderWithRetry(queue, videoId) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await queue.send({ videoId });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(250 * (2 ** attempt));
    }
  }
  throw lastError;
}

function queueUnavailableResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("retry-after", "2");
  return new Response(JSON.stringify({
    message: "Your upload is saved. We’re reconnecting to the video processing queue and will retry automatically.",
    code: "RENDER_QUEUE_UNAVAILABLE",
  }), { status: 503, headers });
}

async function enqueueResponseRender(request, env, response) {
  if (!response.ok) return response;
  const url = new URL(request.url);
  const isUploadCompletion = request.method === "POST" && url.pathname === "/api/videos/complete-upload";
  const isVideoUpdate = request.method === "PATCH" && /^\/api\/videos\/[^/]+$/.test(url.pathname);
  if (!isUploadCompletion && !isVideoUpdate) return response;
  try {
    const data = await response.clone().json();
    const video = data.video;
    if (video?.renderingStatus !== "processing") return response;
    if (!env.VIDEO_RENDER_QUEUE) {
      console.error("Cannot enqueue video render: VIDEO_RENDER_QUEUE binding is missing");
      return queueUnavailableResponse(response);
    }
    await enqueueRenderWithRetry(env.VIDEO_RENDER_QUEUE, video._id);
  } catch (error) {
    console.error("Could not enqueue video render immediately:", error.message);
    return queueUnavailableResponse(response);
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
