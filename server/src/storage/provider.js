import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "node:stream";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getActiveStorageConfig } from "../utils/storageConfig.js";

const readFile = (file) => (file.path ? fs.createReadStream(file.path) : file.buffer);
const cleanBaseUrl = (url) => String(url || "").replace(/\/$/, "");
const safeName = (name) => `${Date.now()}-${crypto.randomUUID()}${path.extname(name) || ".mp4"}`;
let cachedR2Client;

function r2(config) {
  const c = config.values.r2 || {};
  if (!c.accountId || !c.accessKeyId || !c.secretAccessKey || !c.bucket) throw new Error("Cloudflare R2 is not completely configured.");
  if (!cachedR2Client || cachedR2Client.accountId !== c.accountId || cachedR2Client.accessKeyId !== c.accessKeyId || cachedR2Client.secretAccessKey !== c.secretAccessKey) {
    cachedR2Client = {
      accountId: c.accountId,
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      client: new S3Client({ region: "auto", endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } }),
    };
  }
  return { c, client: cachedR2Client.client };
}

export async function getStorageProviderName() {
  await getActiveStorageConfig();
  return "r2";
}

export async function uploadVideo(file, folder = "videos") {
  const config = await getActiveStorageConfig();
  const prefix = folder === "frames"
    ? "bonconnect"
    : (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${folder}/${safeName(file.originalname)}`;
  const { c, client } = r2(config);
  try {
    await client.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: readFile(file), ContentType: file.mimetype || "application/octet-stream" }));
    return { url: `${cleanBaseUrl(c.publicBaseUrl)}/${key}`, thumbnailUrl: "", fileId: key, name: path.basename(key), size: file.size, provider: "r2" };
  } finally { if (file.path) await fs.promises.unlink(file.path).catch(() => {}); }
}

export async function deleteStoredFile(fileId, providerName) {
  if (!fileId) return;
  const config = await getActiveStorageConfig();
  const prefix = (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  if (!String(fileId).startsWith(`${prefix}/`) && !String(fileId).startsWith("bonconnect/")) return;
  const { c, client } = r2(config);
  return client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: fileId }));
}

export async function getRenderableUrl(url, fileId, providerName) {
  const config = await getActiveStorageConfig();
  const prefix = (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  if (!String(fileId || "").startsWith(`${prefix}/`)) return url;
  const { c, client } = r2(config);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: c.bucket, Key: fileId }), { expiresIn: 900 });
}

export async function getStoredVideoStream(url, fileId, providerName) {
  const config = await getActiveStorageConfig();
  const prefix = (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  const key = String(fileId || "");
  if (providerName === "r2" && (key.startsWith(`${prefix}/`) || key.startsWith("bonconnect/"))) {
    const { c, client } = r2(config);
    const object = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }));
    if (!object.Body) throw new Error(`Stored video ${key} has no content`);
    return object.Body;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not retrieve video (HTTP ${response.status})`);
  return Readable.fromWeb(response.body);
}

export async function uploadArchiveStream(body, key, partSize) {
  const config = await getActiveStorageConfig();
  const { c, client } = r2(config);
  const upload = new Upload({
    client,
    params: { Bucket: c.bucket, Key: key, Body: body, ContentType: "application/zip" },
    partSize,
    queueSize: 2,
    leavePartsOnError: false,
  });
  await upload.done();
}

export async function getArchiveObjectKey(filename) {
  const config = await getActiveStorageConfig();
  const prefix = (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  return `${prefix}/archives/${filename}`;
}

export async function getArchiveDownloadUrl(key, filename) {
  const config = await getActiveStorageConfig();
  const prefix = (config.values?.r2?.folderPrefix || process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  if (!String(key || "").startsWith(`${prefix}/archives/`)) throw new Error("Archive file is invalid");
  const { c, client } = r2(config);
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: c.bucket,
    Key: key,
    ResponseContentType: "application/zip",
    ResponseContentDisposition: `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}"`,
  }), { expiresIn: 3600 });
}
