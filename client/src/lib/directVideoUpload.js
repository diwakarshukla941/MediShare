import { api } from "./api.js";

function putToR2(uploadUrl, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    for (const [name, value] of Object.entries(headers || {})) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, file.size);
    };
    request.onerror = () => reject(new Error("Could not connect to R2. Check the bucket CORS setup and your internet connection."));
    request.onabort = () => reject(new Error("Upload cancelled"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`R2 upload failed (HTTP ${request.status})`));
    };
    request.send(file);
  });
}

export async function uploadVideoDirect(file, metadata, onProgress) {
  const { data: intent } = await api.post("/videos/upload-intent", {
    metadata,
    file: { name: file.name, type: file.type, size: file.size },
  });
  await putToR2(intent.uploadUrl, file, intent.headers, onProgress);
  const { data } = await api.post("/videos/complete-upload", { uploadToken: intent.uploadToken });
  return data;
}
