import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, s3Folder } from "../config/s3.js";
import { nanoid } from "nanoid";
import fs from "fs";

export async function uploadToS3(file, subfolder = "videos") {
  const s3 = getS3Client();
  const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("CLOUDFLARE_BUCKET_NAME is not set in .env");
  }

  try {
    const fileContent = file.path ? await fs.promises.readFile(file.path) : file.buffer;
    const fileId = `${nanoid()}-${(file.originalname || "file").replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const key = `${s3Folder(subfolder)}/${fileId}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: file.mimetype || "application/octet-stream",
      })
    );

    const publicDomain = (process.env.CLOUDFLARE_PUBLIC_DOMAIN || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}`).replace(/\/+$/, "");
    const url = `${publicDomain}/${key}`;

    return {
      url: url,
      thumbnailUrl: url,
      fileId: key,
      name: file.originalname || fileId,
      size: file.size || (Buffer.isBuffer(fileContent) ? fileContent.length : 0),
    };
  } finally {
    if (file?.path) await fs.promises.unlink(file.path).catch(() => {});
  }
}

export async function deleteFromS3(fileId) {
  if (!fileId) return;
  const s3 = getS3Client();
  const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;

  if (!bucketName) return;

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileId,
      })
    );
  } catch (err) {
    console.error(`Failed to delete S3 file ${fileId}:`, err.message);
  }
}
