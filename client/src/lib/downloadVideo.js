import { api } from "./api.js";
import { waitForVideoRender } from "./videoProcessing.js";

// The API prepares a short-lived download URL; the browser then downloads
// directly from storage, avoiding a cross-origin blob fetch through R2.

export async function downloadFramedVideo(videoId, { slug, onStatus } = {}) {
  // Rendering happens in the background after upload. Wait on the lightweight
  // status route, then request the signed URL once the stored framed asset is ready.
  if (slug) await waitForVideoRender(slug, onStatus);

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
