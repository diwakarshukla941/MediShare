import fs from "fs";
import path from "path";
import crypto from "crypto";
import ImageKit from "imagekit";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Storage } from "@google-cloud/storage";
import { getActiveStorageConfig } from "../utils/storageConfig.js";

const readFile = (file) => (file.path ? fs.createReadStream(file.path) : file.buffer);
const cleanBaseUrl = (url) => String(url || "").replace(/\/$/, "");
const safeName = (name) => `${Date.now()}-${crypto.randomUUID()}${path.extname(name) || ".mp4"}`;

function imagekit(config) {
  const c = config.values.imagekit || {};
  if (!c.publicKey || !c.privateKey || !c.urlEndpoint) throw new Error("ImageKit is not completely configured.");
  return new ImageKit({ publicKey: c.publicKey, privateKey: c.privateKey, urlEndpoint: c.urlEndpoint });
}

function r2(config) {
  const c = config.values.r2 || {};
  if (!c.accountId || !c.accessKeyId || !c.secretAccessKey || !c.bucket) throw new Error("Cloudflare R2 is not completely configured.");
  return { c, client: new S3Client({ region: "auto", endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } }) };
}

function gcs(config) {
  const c = config.values.gcs || {};
  if (!c.bucket || !c.serviceAccountJson) throw new Error("Google Cloud Storage is not completely configured.");
  let credentials;
  try { credentials = JSON.parse(c.serviceAccountJson); } catch { throw new Error("Google service-account JSON is invalid."); }
  return { c, bucket: new Storage({ credentials, projectId: credentials.project_id }).bucket(c.bucket) };
}

export async function getStorageProviderName() {
  return (await getActiveStorageConfig()).provider;
}

export async function uploadVideo(file, folder = "videos") {
  const config = await getActiveStorageConfig();
  const key = `medishare/${folder}/${safeName(file.originalname)}`;
  if (config.provider === "imagekit") {
    const client = imagekit(config);
    try {
      const c = config.values.imagekit;
      const result = await client.upload({ file: readFile(file), fileName: file.originalname, folder: `${(c.folderPrefix || "/medishare").replace(/\/+$/, "")}/${folder}`, useUniqueFileName: true });
      const details = await client.getFileDetails(result.fileId);
      return { url: details.filePath ? `${cleanBaseUrl(c.urlEndpoint)}/tr:orig-true${details.filePath}` : result.url, thumbnailUrl: details.thumbnail || result.thumbnailUrl || "", fileId: result.fileId, name: result.name, size: result.size || file.size, provider: "imagekit" };
    } finally { if (file.path) await fs.promises.unlink(file.path).catch(() => {}); }
  }
  if (config.provider === "r2") {
    const { c, client } = r2(config);
    try {
      await client.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: readFile(file), ContentType: file.mimetype || "video/mp4" }));
      return { url: `${cleanBaseUrl(c.publicBaseUrl)}/${key}`, thumbnailUrl: "", fileId: key, name: path.basename(key), size: file.size, provider: "r2" };
    } finally { if (file.path) await fs.promises.unlink(file.path).catch(() => {}); }
  }
  if (config.provider === "gcs") {
    const { c, bucket } = gcs(config);
    try {
      await new Promise((resolve, reject) => readFile(file).pipe(bucket.file(key).createWriteStream({ resumable: false, metadata: { contentType: file.mimetype || "video/mp4" } })).on("finish", resolve).on("error", reject));
      return { url: `${cleanBaseUrl(c.publicBaseUrl)}/${key}`, thumbnailUrl: "", fileId: key, name: path.basename(key), size: file.size, provider: "gcs" };
    } finally { if (file.path) await fs.promises.unlink(file.path).catch(() => {}); }
  }
  throw new Error(`Unsupported storage provider: ${config.provider}`);
}

export async function deleteStoredFile(fileId, providerName) {
  if (!fileId) return;
  const config = await getActiveStorageConfig();
  const provider = providerName || config.provider;
  if (provider === "imagekit") return imagekit(config).deleteFile(fileId).catch((err) => console.error("Failed to delete ImageKit file:", err.message));
  if (provider === "r2") { const { c, client } = r2(config); return client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: fileId })); }
  if (provider === "gcs") { const { bucket } = gcs(config); return bucket.file(fileId).delete({ ignoreNotFound: true }); }
}

// The renderer needs a readable source even when the bucket itself is private.
export async function getRenderableUrl(url, fileId, providerName) {
  const config = await getActiveStorageConfig();
  const provider = providerName || config.provider;
  if (provider === "imagekit") return url;
  if (provider === "r2") { const { c, client } = r2(config); return getSignedUrl(client, new GetObjectCommand({ Bucket: c.bucket, Key: fileId }), { expiresIn: 900 }); }
  if (provider === "gcs") { const { bucket } = gcs(config); const [signedUrl] = await bucket.file(fileId).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 15 * 60 * 1000 }); return signedUrl; }
  return url;
}
