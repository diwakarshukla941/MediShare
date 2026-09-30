import { Frame, getActiveFrame } from "../models/Frame.js";
import { Video } from "../models/Video.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { frameCreateSchema, frameUpdateSchema } from "../validators/frame.validator.js";
import { uploadVideo, deleteStoredFile } from "../storage/provider.js";
import { burnFrameToTempFile } from "../utils/composeFramedVideo.js";
import { enqueueBurn } from "../utils/burnQueue.js";
import { AVAILABLE_VARIABLES } from "../utils/resolveVariables.js";

function withMp4Ext(name) {
  return name.replace(/\.[^./\\]+$/, "") + ".mp4";
}

export const listFrames = asyncHandler(async (req, res) => {
  const frames = await Frame.find().sort({ createdAt: -1 });
  const usageCounts = await Video.aggregate([
    { $match: { frameBakedId: { $ne: null } } },
    { $group: { _id: "$frameBakedId", count: { $sum: 1 } } },
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

  const usageCount = await Video.countDocuments({ frameBakedId: frame._id });
  if (usageCount > 0 && req.query.confirm !== "true") {
    throw new ApiError(409, `This frame is permanently burned into ${usageCount} video(s). Confirm to delete anyway.`, {
      usageCount,
    });
  }

  if (frame.background?.fileId) {
    await deleteStoredFile(frame.background.fileId);
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

  // Nothing to re-render — unbaked videos never have a cached burned copy
  // to invalidate (watch pages overlay the active frame live, and downloads
  // always burn fresh on the spot). Only frameBakedId videos are unaffected
  // by this activation at all, by design.
  res.json({ frame });
});

// Videos still holding a clean, unframed source — the only ones a frame can
// ever be burned into. Anything with frameBakedId already set has no clean
// source left (see Video.frameBakedId) and is permanently excluded.
export const listUnbakedVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ frameBakedId: null })
    .select("doctorName empId zone phone fileSize createdAt")
    .sort({ createdAt: -1 });
  res.json({ videos });
});

// Super-admin-only, hidden tool: pick any frame and burn it into a chosen
// set of still-unbaked videos, one at a time, replacing each video's file
// in place (old file deleted) so storage never doubles. This is a one-way
// conversion — once a video is burned this way it behaves exactly like a
// video baked at upload time (frameBakedId set, permanently locked to this
// frame; a future frame change won't touch it again).
export const burnExistingVideos = asyncHandler(async (req, res) => {
  const frame = await Frame.findById(req.params.id);
  if (!frame) throw new ApiError(404, "Frame not found");

  const videoIds = Array.isArray(req.body.videoIds) ? req.body.videoIds : [];
  if (videoIds.length === 0) {
    throw new ApiError(400, "Select at least one video to burn");
  }

  const videos = await Video.find({ _id: { $in: videoIds }, frameBakedId: null });
  const burned = [];
  const errors = [];

  for (const video of videos) {
    let burnedFile;
    try {
      // Same shared queue as regular downloads — a bulk re-burn shouldn't
      // be able to run at the same time as someone else's download burn.
      burnedFile = await enqueueBurn(() => burnFrameToTempFile(video.videoUrl, frame, video));
      // uploadVideoToImageKit streams from disk and deletes burnedFile.path
      // itself once done — no separate cleanup call needed on success.
      const uploaded = await uploadVideo({
        path: burnedFile.path,
        originalname: withMp4Ext(video.fileName),
        mimetype: "video/mp4",
      });

      const oldFileId = video.imagekitFileId;
      video.videoUrl = uploaded.url;
      video.imagekitFileId = uploaded.fileId;
      video.storageProvider = uploaded.provider;
      video.fileName = uploaded.name;
      video.fileSize = uploaded.size;
      video.frameBakedId = frame._id;
      await video.save();

      deleteStoredFile(oldFileId, video.storageProvider).catch(() => {});
      burned.push({ id: video._id, doctorName: video.doctorName });
    } catch (err) {
      errors.push({ id: video._id, doctorName: video.doctorName, error: (err.message || "Failed").slice(0, 300) });
    } finally {
      await burnedFile?.cleanup();
    }
  }

  res.json({ burnedCount: burned.length, errorCount: errors.length, burned, errors });
});

export const uploadFrameAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "An image file is required");

  const uploaded = await uploadVideo(req.file, "frames");
  res.json({ url: uploaded.url, fileId: uploaded.fileId });
});
