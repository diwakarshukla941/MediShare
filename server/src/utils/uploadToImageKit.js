import fs from "fs";
import { getImageKit, imagekitFolder } from "../config/imagekit.js";

// Accepts either a disk-backed multer file (file.path, from diskStorage) or
// an in-memory one (file.buffer, from memoryStorage) — streaming from disk
// keeps the whole video from ever sitting in the process's memory at once,
// which matters a lot on a 512MB container. Always cleans up the temp file
// afterward; diskStorage doesn't do that on its own.
export async function uploadVideoToImageKit(file) {
  const imagekit = getImageKit();
  try {
    const source = file.path ? fs.createReadStream(file.path) : file.buffer;
    const result = await imagekit.upload({
      file: source,
      fileName: file.originalname,
      folder: imagekitFolder("videos"),
      useUniqueFileName: true,
    });

    return {
      url: result.url,
      thumbnailUrl: result.thumbnailUrl || "",
      fileId: result.fileId,
      name: result.name,
      size: result.size || file.size,
    };
  } finally {
    if (file.path) await fs.promises.unlink(file.path).catch(() => {});
  }
}

export async function deleteFromImageKit(fileId) {
  if (!fileId) return;
  const imagekit = getImageKit();
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    console.error(`Failed to delete ImageKit file ${fileId}:`, err.message);
  }
}
