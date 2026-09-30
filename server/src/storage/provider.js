import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "node:stream";
import { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getActiveStorageConfig } from "../utils/storageConfig.js";

const readFile = (file) => (file.path ? fs.createReadStream(file.path) : file.buffer);
const cleanBaseUrl = (url) => String(url || "").replace(/\/$/, "");
const safeName = (name) => `${Date.now()}-${crypto.randomUUID()}${path.extname(name) || ".mp4"}`;
let cachedR2Client;

function r2(config) {
  const c = config.values.r2 || {};
  const missing = ["accountId", "accessKeyId", "secretAccessKey", "bucket", "publicBaseUrl", "folderPrefix"]
    .filter((key) => !String(c[key] || "").trim() || /^(undefined|null)$/i.test(String(c[key]).trim()));
  if (missing.length) throw new Error(`Cloudflare R2 environment is incomplete. Set: ${missing.map((key) => ({
    accountId: "CLOUDFLARE_ACCOUNT_ID",
    accessKeyId: "CLOUDFLARE_ACCESS_KEY_ID",
    secretAccessKey: "CLOUDFLARE_SECRET_ACCESS_KEY",
    bucket: "CLOUDFLARE_BUCKET_NAME",
    publicBaseUrl: "CLOUDFLARE_PUBLIC_DOMAIN",
    folderPrefix: "CLOUDFLARE_FOLDER_PREFIX",
  })[key]).join(", ")}`);
  if (!cachedR2Client || cachedR2Client.accountId !== c.accountId || cachedR2Client.accessKeyId !== c.accessKeyId || cachedR2Client.secretAccessKey !== c.secretAccessKey) {
    cachedR2Client = {
      accountId: c.accountId,
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
        // R2's S3 API expects the bucket in the URL path. Without this,
        // the SDK puts it in the hostname (bucket.account-id.r2...), which
        // breaks browser uploads and presigned URL signatures.
        forcePathStyle: true,
        credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
        // R2 does not support the AWS SDK's optional streaming checksum mode.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }
  return { c, client: cachedR2Client.client };
}

const folderPrefix = (config) => String(config.values?.r2?.folderPrefix || "").replace(/^\/+|\/+$/g, "");

export async function getStorageProviderName() {
  await getActiveStorageConfig();
  return "r2";
}

export async function uploadVideo(file, folder = "videos") {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  const key = `${prefix}/${folder}/${safeName(file.originalname)}`;
  const { c, client } = r2(config);
  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: c.bucket,
        Key: key,
        Body: readFile(file),
        ContentType: file.mimetype || "application/octet-stream",
      },
      queueSize: 2,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false,
    });
    await upload.done();
    return { url: `${cleanBaseUrl(c.publicBaseUrl)}/${key}`, thumbnailUrl: "", fileId: key, name: path.basename(key), size: file.size, provider: "r2" };
  } finally { if (file.path) await fs.promises.unlink(file.path).catch(() => {}); }
}

// Issue a short-lived, content-type-bound URL so the browser can send video
// bytes directly to R2. The API never receives or buffers the video body.
export async function createDirectVideoUpload({ originalname, mimetype, intentId }) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  const key = `${prefix}/uploads/${intentId}${path.extname(originalname).toLowerCase() || ".mp4"}`;
  const { c, client } = r2(config);
  const command = new PutObjectCommand({
    Bucket: c.bucket,
    Key: key,
    ContentType: mimetype,
    Metadata: { "upload-intent": intentId },
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 15 * 60 });
  return { key, uploadUrl, headers: { "Content-Type": mimetype, "x-amz-meta-upload-intent": intentId } };
}

export async function verifyDirectVideoUpload(key, intentId, expectedSize, expectedType) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  if (!String(key).startsWith(`${prefix}/uploads/${intentId}.`)) throw new Error("Upload object does not match its upload intent");
  const { c, client } = r2(config);
  const head = await client.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
  if (head.ContentLength !== expectedSize) throw new Error("Uploaded file size does not match the upload request");
  if (head.ContentType !== expectedType) throw new Error("Uploaded file type does not match the upload request");
  if (head.Metadata?.["upload-intent"] !== intentId) throw new Error("Uploaded file metadata does not match the upload request");
  return { url: `${cleanBaseUrl(c.publicBaseUrl)}/${key}`, size: head.ContentLength };
}

export async function promoteDirectVideoUpload(key, intentId, originalname) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  if (!String(key).startsWith(`${prefix}/uploads/${intentId}.`)) throw new Error("Upload object does not match its upload intent");
  const { c, client } = r2(config);
  const sourceKey = `${prefix}/sources/${intentId}${path.extname(originalname).toLowerCase() || ".mp4"}`;
  const encodedSource = `${c.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  await client.send(new CopyObjectCommand({ Bucket: c.bucket, Key: sourceKey, CopySource: encodedSource, MetadataDirective: "COPY" }));
  return { key: sourceKey, url: `${cleanBaseUrl(c.publicBaseUrl)}/${sourceKey}` };
}

export async function deleteStoredFile(fileId, providerName) {
  if (!fileId) return;
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  if (!String(fileId).startsWith(`${prefix}/`) && !String(fileId).startsWith("bonconnect/")) return;
  const { c, client } = r2(config);
  return client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: fileId }));
}

export async function getRenderableUrl(url, fileId, providerName) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  if (!String(fileId || "").startsWith(`${prefix}/`)) return url;
  const { c, client } = r2(config);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: c.bucket, Key: fileId }), { expiresIn: 900 });
}

export async function getStoredVideoStream(url, fileId, providerName) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
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
  const prefix = folderPrefix(config);
  return `${prefix}/archives/${filename}`;
}

export async function getArchiveDownloadUrl(key, filename) {
  const config = await getActiveStorageConfig();
  const prefix = folderPrefix(config);
  if (!String(key || "").startsWith(`${prefix}/archives/`)) throw new Error("Archive file is invalid");
  const { c, client } = r2(config);
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: c.bucket,
    Key: key,
    ResponseContentType: "application/zip",
    ResponseContentDisposition: `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}"`,
  }), { expiresIn: 3600 });
}
