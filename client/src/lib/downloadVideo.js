import { api } from "./api.js";

// The API prepares a short-lived download URL; the browser then downloads
// directly from storage, avoiding a cross-origin blob fetch through R2.

export async function downloadFramedVideo(videoId, { slug, onStatus } = {}) {
  const deadline = Date.now() + 15 * 60 * 1000;
  let status = "processing";

  // Rendering happens in the background after upload. Poll the lightweight
  // status route, then ask the API for a signed URL only when the stored
  // framed asset is ready. This avoids repeated download requests/rate limits.
  while (slug && status === "processing" && Date.now() < deadline) {
    const { data } = await api.get(`/videos/public/${slug}/status`);
    status = data.renderingStatus;
    if (status === "failed") throw new Error(data.renderingError || "The framed video could not be prepared.");
    if (status === "processing") {
      onStatus?.("Your framed video is being prepared. The download will start automatically when it is ready.");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (status === "processing") {
    throw new Error("The video is still being prepared. Keep this page open and try the download again shortly.");
  }

  const { data } = await api.get(`/videos/${videoId}/download`);
  if (data?.status === "processing") {
    throw new Error("Your framed video is being prepared. Try the download again shortly.");
  }
  if (!data?.downloadUrl) throw new Error("The server did not return a download URL");
  window.location.assign(data.downloadUrl);
}

export async function downloadVideosSpreadsheet() {
  const response = await api.get("/videos/export", { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bonconnect-videos.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function createVideosArchive(zone = "all") {
  const response = await api.post("/videos/bulk-download", { zone });
  return response.data.job;
}

export async function getVideosArchiveStatus(jobId) {
  const response = await api.get(`/videos/bulk-download/${jobId}`);
  return response.data.job;
}

export function downloadVideosArchive(url) {
  const a = document.createElement("a");
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// With responseType: "blob", axios hands back a Blob even for error
// responses — getErrorMessage's `err.response.data.message` lookup can't
// see inside it, so unwrap the JSON ourselves when that's what came back.
export async function getDownloadErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob && data.type.includes("json")) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.message || "Something went wrong";
    } catch {
      return "Something went wrong";
    }
  }
  return err?.message || "Something went wrong";
}
