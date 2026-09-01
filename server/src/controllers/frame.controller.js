import { Frame, getActiveFrame } from "../models/Frame.js";
import { Video } from "../models/Video.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { frameCreateSchema, frameUpdateSchema } from "../validators/frame.validator.js";
import { getImageKit } from "../config/imagekit.js";
import { deleteFromImageKit } from "../utils/uploadToImageKit.js";
import { enqueueRenderForAllVideos } from "../utils/renderQueue.js";
import { AVAILABLE_VARIABLES } from "../utils/resolveVariables.js";

export const listFrames = asyncHandler(async (req, res) => {
  const frames = await Frame.find().sort({ createdAt: -1 });
  const usageCounts = await Video.aggregate([
    { $match: { renderedFrameId: { $ne: null } } },
    { $group: { _id: "$renderedFrameId", count: { $sum: 1 } } },
  ]);
  const usageMap = new Map(usageCounts.map((u) => [u._id.toString(), u.count]));

  res.json({
    frames: frames.map((f) => ({ ...f.toObject(), usageCount: usageMap.get(f._id.toString()) || 0 })),
    variables: AVAILABLE_VARIABLES,
  });
});

export const getFrame = asyncHandler(async (req, res) => {
  const frame = await Frame.findById(req.params.id);
  if (!frame) throw new ApiError(404, "Frame not found");
  res.json({ frame, variables: AVAILABLE_VARIABLES });
});

export const getActiveFrameHandler = asyncHandler(async (req, res) => {
  const frame = await getActiveFrame();
  res.json({ frame: frame || null });
});

export const createFrame = asyncHandler(async (req, res) => {
  const data = frameCreateSchema.parse(req.body);
  const frame = await Frame.create(data);
  res.status(201).json({ frame });
});

export const updateFrame = asyncHandler(async (req, res) => {
  const updates = frameUpdateSchema.parse(req.body);
  const frame = await Frame.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!frame) throw new ApiError(404, "Frame not found");
  res.json({ frame });
});

export const duplicateFrame = asyncHandler(async (req, res) => {
  const source = await Frame.findById(req.params.id);
  if (!source) throw new ApiError(404, "Frame not found");

  const copy = await Frame.create({
    name: `${source.name} (Copy)`,
    width: source.width,
    height: source.height,
    aspectRatio: source.aspectRatio,
    background: source.background,
    elements: source.elements,
    isActive: false,
  });

  res.status(201).json({ frame: copy });
});

export const deleteFrame = asyncHandler(async (req, res) => {
  const frame = await Frame.findById(req.params.id);
  if (!frame) throw new ApiError(404, "Frame not found");

  const usageCount = await Video.countDocuments({ renderedFrameId: frame._id });
  if (usageCount > 0 && req.query.confirm !== "true") {
    throw new ApiError(409, `This frame is used by ${usageCount} rendered video(s). Confirm to delete anyway.`, {
      usageCount,
    });
  }

  if (frame.background?.imagekitFileId) {
    await deleteFromImageKit(frame.background.imagekitFileId);
  }

  await frame.deleteOne();
  res.json({ message: "Frame deleted" });
});

export const activateFrame = asyncHandler(async (req, res) => {
  const frame = await Frame.findById(req.params.id);
  if (!frame) throw new ApiError(404, "Frame not found");

  const hasVideoElement = (frame.elements || []).some((el) => el.type === "video" && !el.hidden);
  if (!hasVideoElement) {
    throw new ApiError(400, "Add a Video Area element to this frame before activating it");
  }

  await Frame.updateMany({ _id: { $ne: frame._id } }, { isActive: false });
  frame.isActive = true;
  await frame.save();

  const queuedCount = await enqueueRenderForAllVideos();

  res.json({ frame, queuedCount });
});

export const uploadFrameAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "An image file is required");

  const imagekit = getImageKit();
  const uploaded = await imagekit.upload({
    file: req.file.buffer,
    fileName: req.file.originalname,
    folder: "/medishare/frame-assets",
    useUniqueFileName: true,
  });

  res.json({ url: uploaded.url, fileId: uploaded.fileId });
});
