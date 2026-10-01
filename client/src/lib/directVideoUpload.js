import { api } from "./api.js";
import { waitForVideoRender } from "./videoProcessing.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function completeUpload(uploadToken, onStatus) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await api.post("/videos/complete-upload", { uploadToken });
    } catch (error) {
      const status = error?.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= 8) throw error;
      onStatus?.("Your video is safely uploaded. Retrying confirmation and frame scheduling...");
      await wait(Math.min(1000 * (2 ** attempt), 15000));
    }
  }
}

function putToR2(uploadUrl, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    for (const [name, value] of Object.entries(headers || {})) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, file.size);
    };
    request.onerror = () => reject(Object.assign(
      new Error("Could not connect to R2. Check the bucket CORS setup and your internet connection."),
      { retryable: true },
    ));
    request.onabort = () => reject(new Error("Upload cancelled"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(Object.assign(new Error(`R2 upload failed (HTTP ${request.status})`), {
        retryable: request.status === 429 || request.status >= 500,
      }));
    };
    request.send(file);
  });
}

export async function uploadVideoDirect(file, metadata, onProgress, { waitForRender = false, onStatus } = {}) {
  const { data: intent } = await api.post("/videos/upload-intent", {
    metadata,
    file: { name: file.name, type: file.type, size: file.size },
  });
  for (let attempt = 0; ; attempt += 1) {
    try {
      await putToR2(intent.uploadUrl, file, intent.headers, onProgress);
      break;
    } catch (error) {
      if (!error.retryable || attempt >= 2) throw error;
      onStatus?.("Connection interrupted. Retrying the secure upload...");
      await wait(1000 * (2 ** attempt));
    }
  }
  onStatus?.("Upload saved. Confirming it with the server...");
  const { data } = await completeUpload(intent.uploadToken, onStatus);
  if (waitForRender && data.slug && data.video?.renderingStatus !== "completed") {
    await waitForVideoRender(data.slug, onStatus);
  }
  return data;
}
