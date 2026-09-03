import { parseSheetFile } from "../utils/parseSheetFile.js";
import { Video } from "../models/Video.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadVideoToImageKit, deleteFromImageKit } from "../utils/uploadToImageKit.js";
import { videoMetaSchema, videoUpdateSchema } from "../validators/video.validator.js";
import { detectDevice } from "../utils/detectDevice.js";
import { getActiveFrame } from "../models/Frame.js";
import { frameVersion } from "../utils/composeFramedVideo.js";
import { enqueueRender } from "../utils/renderQueue.js";
import { resolveContentTemplate } from "../utils/resolveContentTemplate.js";

export const createVideo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "A video file is required");
  }

  const meta = videoMetaSchema.parse(req.body);
  const [uploaded, content] = await Promise.all([
    uploadVideoToImageKit(req.file),
    resolveContentTemplate(meta.email),
  ]);

  const video = await Video.create({
    ...meta,
    ...content,
    videoUrl: uploaded.url,
    thumbnailUrl: uploaded.thumbnailUrl,
    imagekitFileId: uploaded.fileId,
    fileName: uploaded.name,
    fileSize: uploaded.size,
    source: req.admin ? "dashboard" : "public",
    uploadedBy: req.admin?._id || null,
    uploadedByName: req.admin?.name || "",
    uploadedByEmail: req.admin?.email || "",
    uploadedByLocation: req.admin?.location || "",
  });

  enqueueRender(video._id).catch(() => {});

  res.status(201).json({
    video,
    slug: video.slug,
    watchPath: `/watch/${video.slug}`,
  });
});

export const bulkCreateVideos = asyncHandler(async (req, res) => {
  const videoFiles = req.files?.videos || [];
  const sheetFile = req.files?.sheet?.[0];

  if (videoFiles.length === 0) {
    throw new ApiError(400, "At least one video file is required");
  }
  if (!sheetFile) {
    throw new ApiError(400, "A CSV or Excel file with video metadata is required for bulk upload");
  }

  let rows;
  try {
    rows = parseSheetFile(sheetFile);
  } catch {
    throw new ApiError(400, "Could not parse the metadata file. Please use the sample template.");
  }

  const rowsByFileName = new Map(
    rows.map((row) => [String(row.filename || "").trim().toLowerCase(), row])
  );

  const created = [];
  const errors = [];

  for (const file of videoFiles) {
    const row = rowsByFileName.get(file.originalname.trim().toLowerCase());
    if (!row) {
      errors.push({ fileName: file.originalname, error: "No matching row in CSV (check the fileName column)" });
      continue;
    }

    const parsedMeta = videoMetaSchema.safeParse({
      doctorName: row.doctorname,
      degree: row.degree,
      specialization: row.specialization,
      organizationName: row.organizationname,
      phone: row.phone,
      email: row.email,
    });

    if (!parsedMeta.success) {
      errors.push({
        fileName: file.originalname,
        error: parsedMeta.error.issues.map((i) => i.message).join(", "),
      });
      continue;
    }

    try {
      const [uploaded, content] = await Promise.all([
        uploadVideoToImageKit(file),
        resolveContentTemplate(parsedMeta.data.email),
      ]);
      const video = await Video.create({
        ...parsedMeta.data,
        ...content,
        videoUrl: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl,
        imagekitFileId: uploaded.fileId,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        source: "bulk",
        uploadedBy: req.admin._id,
        uploadedByName: req.admin.name,
        uploadedByEmail: req.admin.email,
        uploadedByLocation: req.admin.location || "",
      });
      enqueueRender(video._id).catch(() => {});
      created.push(video);
    } catch (err) {
      errors.push({ fileName: file.originalname, error: err.message || "Upload failed" });
    }
  }

  res.status(201).json({ created, errors, createdCount: created.length, errorCount: errors.length });
});

export const getSampleCsv = asyncHandler(async (req, res) => {
  const csv = [
    "fileName,doctorName,degree,specialization,phone,email,organizationName",
    "sleep-tips.mp4,Dr. Diwakar Shukla,MBBS,General Physician,+91 12345 67890,diwakar@medicare.example,MediCare Clinic",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=medishare-bulk-upload-sample.csv");
  res.send(csv);
});

export const listVideos = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const search = (req.query.search || "").trim();
  // Phone numbers often contain "+", which is invalid at the start of a regex
  // (PCRE throws "nothing to repeat") — escape special chars before matching.
  const searchPattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filter = search
    ? {
        $or: [
          { doctorName: { $regex: searchPattern, $options: "i" } },
          { phone: { $regex: searchPattern, $options: "i" } },
          { email: { $regex: searchPattern, $options: "i" } },
        ],
      }
    : {};

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Video.countDocuments(filter),
  ]);

  res.json({
    videos,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

export const getVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw new ApiError(404, "Video not found");
  res.json({ video });
});

export const getPublicVideo = asyncHandler(async (req, res) => {
  const video = await Video.findOneAndUpdate(
    { slug: req.params.slug },
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  AnalyticsEvent.create({
    video: video._id,
    eventType: "view",
    sessionId: typeof req.query.sid === "string" ? req.query.sid.slice(0, 64) : "",
    device: detectDevice(req.headers["user-agent"]),
  }).catch((err) => console.error("Failed to log view event:", err.message));

  res.json({ video });
});

export const trackWatch = asyncHandler(async (req, res) => {
  const { sessionId, seconds } = req.body;
  const watchDuration = Math.max(0, Math.min(Number(seconds) || 0, 6 * 60 * 60));

  if (watchDuration > 0) {
    const video = await Video.findById(req.params.id).select("_id");
    if (video) {
      await AnalyticsEvent.create({
        video: video._id,
        eventType: "watch",
        sessionId: typeof sessionId === "string" ? sessionId.slice(0, 64) : "",
        watchDuration,
      });
    }
  }

  res.status(204).end();
});

export const updateVideo = asyncHandler(async (req, res) => {
  const updates = videoUpdateSchema.parse(req.body);

  const video = await Video.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Text fields may feed {{variables}} in the active frame — re-render to reflect the edit.
  enqueueRender(video._id).catch(() => {});

  res.json({ video });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  await deleteFromImageKit(video.imagekitFileId);
  if (video.renderedImagekitFileId) await deleteFromImageKit(video.renderedImagekitFileId);
  await video.deleteOne();
  AnalyticsEvent.deleteMany({ video: video._id }).catch((err) =>
    console.error("Failed to clean up analytics events:", err.message)
  );

  res.json({ message: "Video deleted successfully" });
});

export const incrementShare = asyncHandler(async (req, res) => {
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    { $inc: { shareCount: 1 } },
    { new: true }
  );
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  AnalyticsEvent.create({ video: video._id, eventType: "share" }).catch((err) =>
    console.error("Failed to log share event:", err.message)
  );

  res.json({ shareCount: video.shareCount });
});

export const getFramedDownload = asyncHandler(async (req, res) => {
  let video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const frame = await getActiveFrame();
  if (!frame) {
    // No frame configured — the original upload is the only file available.
    return res.json({ url: `${video.videoUrl}?ik-attachment=true` });
  }

  const version = frameVersion(frame);
  const isCurrent = video.renderingStatus === "completed" && video.renderedFrameVersion === version;

  if (!isCurrent) {
    await enqueueRender(video._id);
    video = await Video.findById(req.params.id);
  }

  if (video.renderingStatus === "failed") {
    throw new ApiError(500, video.renderingError || "Rendering the framed video failed");
  }
  if (video.renderingStatus !== "completed" || !video.renderedUrl) {
    throw new ApiError(409, "Your video is still processing — try again in a moment");
  }

  res.json({ url: `${video.renderedUrl}?ik-attachment=true` });
});

export const getStats = asyncHandler(async (req, res) => {
  const [agg] = await Video.aggregate([
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalShares: { $sum: "$shareCount" },
        storageUsed: { $sum: "$fileSize" },
      },
    },
  ]);

  const topVideos = await Video.find().sort({ views: -1 }).limit(8).select("title doctorName views shareCount slug");

  res.json({
    totalVideos: agg?.totalVideos || 0,
    totalViews: agg?.totalViews || 0,
    totalShares: agg?.totalShares || 0,
    storageUsed: agg?.storageUsed || 0,
    topVideos,
  });
});
