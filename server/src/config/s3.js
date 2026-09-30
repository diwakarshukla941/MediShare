import { S3Client } from "@aws-sdk/client-s3";

let client = null;

export function getS3Client() {
  if (client) return client;

  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ACCESS_KEY_ID,
    CLOUDFLARE_SECRET_ACCESS_KEY,
  } = process.env;

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_ACCESS_KEY_ID || !CLOUDFLARE_SECRET_ACCESS_KEY) {
    throw new Error(
      "Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID and CLOUDFLARE_SECRET_ACCESS_KEY in server/.env"
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

export function s3Folder(subfolder) {
  const prefix = (process.env.CLOUDFLARE_FOLDER_PREFIX || "bonconnect").replace(/^\/+|\/+$/g, "");
  return `${prefix}/${subfolder}`;
}
