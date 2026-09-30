import { api } from "./api.js";

// The download endpoint is now a plain GET that streams the file directly
// (redirecting instantly for already-framed videos, or burning the active
// frame in on the spot and streaming the result for everything else — see
// server/src/controllers/video.controller.js). Fetch it as a blob and
// trigger a normal browser save, rather than navigating to a JSON-wrapped URL.
export async function downloadFramedVideo(videoId, filename) {
  const response = await api.get(`/videos/${videoId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
