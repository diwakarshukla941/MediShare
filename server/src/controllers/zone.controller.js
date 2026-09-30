import { Zone } from "../models/Zone.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const nameFrom = (body) => String(body?.name || "").trim();

export const listZones = asyncHandler(async (_req, res) => {
  res.json({ zones: await Zone.find().sort({ name: 1 }) });
});

export const createZone = asyncHandler(async (req, res) => {
  const names = String(req.body?.name || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) throw new ApiError(400, "Enter at least one city name");
  const uniqueNames = [...new Map(names.map((name) => [name.toLowerCase(), name])).values()];
  const existing = await Zone.find({ name: { $in: uniqueNames } }).select("name").lean();
  const existingNames = new Set(existing.map((zone) => zone.name.toLowerCase()));
  const toCreate = uniqueNames.filter((name) => !existingNames.has(name.toLowerCase()));
  const zones = toCreate.length ? await Zone.insertMany(toCreate.map((name) => ({ name })), { ordered: false }) : [];
  res.status(201).json({ zones, createdCount: zones.length, skippedCount: uniqueNames.length - zones.length });
});

export const updateZone = asyncHandler(async (req, res) => {
  const name = nameFrom(req.body);
  if (!name) throw new ApiError(400, "Zone name is required");
  const zone = await Zone.findByIdAndUpdate(req.params.id, { name }, { new: true, runValidators: true });
  if (!zone) throw new ApiError(404, "Zone not found");
  res.json({ zone });
});

export const deleteZone = asyncHandler(async (req, res) => {
  const zone = await Zone.findByIdAndDelete(req.params.id);
  if (!zone) throw new ApiError(404, "Zone not found");
  res.json({ message: "Zone deleted" });
});
