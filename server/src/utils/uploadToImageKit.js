import { getImageKit, imagekitFolder } from "../config/imagekit.js";

export async function uploadVideoToImageKit(file) {
  const imagekit = getImageKit();

  const result = await imagekit.upload({
    file: file.buffer,
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
