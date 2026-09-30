import { asyncHandler } from "../utils/asyncHandler.js";
import { getActiveStorageConfig, publicStorageConfig, saveStorageConfig } from "../utils/storageConfig.js";

export const getStorageConfig = asyncHandler(async (_req, res) => {
  const config = await getActiveStorageConfig();
  res.json({ storage: publicStorageConfig(config) });
});

export const updateStorageConfig = asyncHandler(async (req, res) => {
  const storage = await saveStorageConfig({ ...req.body, adminId: req.admin._id });
  res.json({ storage, message: "Storage configuration saved" });
});
