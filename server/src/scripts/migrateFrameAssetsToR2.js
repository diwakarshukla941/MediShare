import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import mongoose from "mongoose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Frame } from "../models/Frame.js";
import { getActiveStorageConfig } from "../utils/storageConfig.js";

const apply = process.argv.includes("--apply");
const mongoUri = process.env.MONGODB_URI;
const imageKitEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const prefix = "bonconnect";
const imageKitHost = imageKitEndpoint ? new URL(imageKitEndpoint).host : "";
let bucket;
let publicDomain;
let r2;

function isImageKitUrl(value) {
  try {
    const host = new URL(value).host;
    return (imageKitHost && host === imageKitHost) || host.endsWith(".imagekit.io");
  } catch {
    return false;
  }
}

function extensionFor(url, contentType) {
  const urlExtension = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(png|jpe?g|webp|svg|gif)$/.test(urlExtension)) return urlExtension;
  const mimeExtension = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/gif": ".gif",
  }[contentType.split(";")[0].trim().toLowerCase()];
  return mimeExtension || ".img";
}

async function copyImageToR2(sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok || !response.body) throw new Error(`ImageKit download failed (${response.status})`);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const hash = crypto.createHash("sha256").update(sourceUrl).digest("hex");
  const key = `${prefix}/frames/${hash}${extensionFor(sourceUrl, contentType)}`;
  const tempPath = path.join(os.tmpdir(), `medishare-frame-${hash}`);

  try {
    await pipeline(response.body, fs.createWriteStream(tempPath));
    const file = await fs.promises.open(tempPath, "r");
    const { size } = await file.stat();
    await file.close();
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(tempPath),
      ContentLength: size,
      ContentType: contentType,
    }));
    return { key, url: `${publicDomain}/${key}` };
  } finally {
    await fs.promises.unlink(tempPath).catch(() => {});
  }
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri);
  const storage = await getActiveStorageConfig();
  const config = storage.values.r2 || {};
  const resolvedAccountId = config.accountId || accountId;
  const resolvedAccessKeyId = config.accessKeyId || accessKeyId;
  const resolvedSecretAccessKey = config.secretAccessKey || secretAccessKey;
  bucket = config.bucket || process.env.CLOUDFLARE_BUCKET_NAME;
  publicDomain = String(config.publicBaseUrl || process.env.CLOUDFLARE_PUBLIC_DOMAIN || "").replace(/\/+$/, "");
  if (resolvedAccountId && resolvedAccessKeyId && resolvedSecretAccessKey) {
    r2 = new S3Client({
      region: "auto",
      endpoint: `https://${resolvedAccountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: resolvedAccessKeyId, secretAccessKey: resolvedSecretAccessKey },
    });
  }
  if (apply && (!r2 || !bucket || !publicDomain)) {
    await mongoose.disconnect();
    throw new Error("Complete Cloudflare R2 settings are required before applying the migration");
  }
  let migrated = 0;
  let skipped = 0;
  try {
    const frames = await Frame.find();
    for (const frame of frames) {
      let changed = false;
      const backgroundUrl = frame.background?.value;
      if (frame.background?.type === "image" && isImageKitUrl(backgroundUrl)) {
        if (apply) {
          const target = await copyImageToR2(backgroundUrl);
          frame.background.value = target.url;
          frame.background.fileId = target.key;
          await frame.save();
          migrated += 1;
        } else {
          console.log(`Would migrate frame background: ${frame._id}`);
          skipped += 1;
        }
        changed = true;
      }

      for (const element of frame.elements || []) {
        if (element.type !== "image" || !isImageKitUrl(element.src)) continue;
        if (apply) {
          const target = await copyImageToR2(element.src);
          element.src = target.url;
          element.fileId = target.key;
          migrated += 1;
          changed = true;
        } else {
          console.log(`Would migrate frame image element: ${frame._id}/${element.id || "unknown"}`);
          skipped += 1;
        }
      }
      if (apply && changed) {
        await frame.save();
        await Frame.updateOne(
          { _id: frame._id },
          { $unset: { "background.imagekitFileId": "", "background.storageProvider": "" } }
        );
      }
    }
  } finally {
    await mongoose.disconnect();
    r2?.destroy();
  }
  console.log(`${apply ? "Migrated" : "Dry run found"} ${apply ? migrated : skipped} ImageKit frame image(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
