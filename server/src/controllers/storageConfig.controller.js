import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getActiveStorageConfig, publicStorageConfig } from "../utils/storageConfig.js";

export const getStorageConfig = asyncHandler(async (_req, res) => {
  const config = await getActiveStorageConfig();
  res.json({ storage: publicStorageConfig(config) });
});

export const updateStorageConfig = asyncHandler(async () => {
  throw new ApiError(409, "R2 settings are managed through Cloudflare Worker environment variables.");
});
