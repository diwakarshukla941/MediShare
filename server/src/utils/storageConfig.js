import crypto from "crypto";
import { StorageConfig } from "../models/StorageConfig.js";
import { ApiError } from "./ApiError.js";

const PROVIDERS = ["r2"];
const cache = { value: null, expiresAt: 0 };

function encryptionKey() {
  // A dedicated deployment secret is recommended. JWT_SECRET is a safe
  // backward-compatible fallback for existing installations, so enabling the
  // dashboard does not break a running app before that secret is added.
  const secret = process.env.STORAGE_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new ApiError(503, "Storage settings are unavailable. Set STORAGE_CONFIG_ENCRYPTION_KEY on the server first.");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

function decrypt(value) {
  const data = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}

function envConfig() {
  return {
    provider: "r2",
    values: {
      r2: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || "",
        bucket: process.env.CLOUDFLARE_BUCKET_NAME || "",
        publicBaseUrl: process.env.CLOUDFLARE_PUBLIC_DOMAIN || "",
      },
    },
    source: "environment",
  };
}

export async function getActiveStorageConfig() {
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;
  const doc = await StorageConfig.findOne({ key: "primary" }).lean();
  const environment = envConfig();
  const savedValues = doc?.encryptedConfig ? decrypt(doc.encryptedConfig) : {};
  const result = {
    provider: "r2",
    values: { ...environment.values, ...savedValues, r2: { ...environment.values.r2, ...savedValues.r2 } },
    source: doc?.encryptedConfig ? "dashboard" : "environment",
  };
  cache.value = result;
  cache.expiresAt = Date.now() + 30_000;
  return result;
}

export function clearStorageConfigCache() {
  cache.value = null;
  cache.expiresAt = 0;
}

export function publicStorageConfig(config) {
  const values = config.values || {};
  const has = (value) => Boolean(value && String(value).trim());
  return {
    provider: config.provider,
    source: config.source,
    configured: {
      r2: has(values.r2?.accountId) && has(values.r2?.accessKeyId) && has(values.r2?.secretAccessKey) && has(values.r2?.bucket) && has(values.r2?.publicBaseUrl),
    },
  };
}

export async function saveStorageConfig({ provider, values, adminId }) {
  if (!PROVIDERS.includes(provider)) throw new ApiError(400, "Unsupported storage provider");
  if (!values?.[provider]) throw new ApiError(400, "Provider credentials are required");
  const existing = await StorageConfig.findOne({ key: "primary" }).lean();
  const environment = envConfig();
  const savedValues = existing?.encryptedConfig ? decrypt(existing.encryptedConfig) : {};
  const previous = { ...environment.values, ...savedValues, r2: { ...environment.values.r2, ...savedValues.r2 } };
  // Blank secret fields mean "keep the previously saved value", allowing
  // admins to change a CDN URL without exposing or re-entering credentials.
  const merged = { ...previous, [provider]: { ...(previous[provider] || {}), ...Object.fromEntries(Object.entries(values[provider]).filter(([, v]) => v !== "")) } };
  const required = ["accountId", "accessKeyId", "secretAccessKey", "bucket", "publicBaseUrl"];
  const missing = required.filter((key) => !String(merged[provider]?.[key] || "").trim());
  if (missing.length) throw new ApiError(400, `Missing required ${provider} settings: ${missing.join(", ")}`);
  await StorageConfig.findOneAndUpdate(
    { key: "primary" },
    { provider, encryptedConfig: encrypt(merged), updatedBy: adminId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  clearStorageConfigCache();
  return publicStorageConfig({ provider, values: merged, source: "dashboard" });
}
