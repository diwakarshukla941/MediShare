import fs from "fs";
import * as XLSX from "xlsx";
import { parseSheetFile } from "../utils/parseSheetFile.js";
import { Video } from "../models/Video.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadVideoToImageKit, deleteFromImageKit } from "../utils/uploadToImageKit.js";
import { videoMetaSchema, videoUpdateSchema } from "../validators/video.validator.js";
import { detectDevice } from "../utils/detectDevice.js";
import { getActiveFrame } from "../models/Frame.js";
import { burnFrameToTempFile, frameVersion } from "../utils/composeFramedVideo.js";
import { enqueueBurn } from "../utils/burnQueue.js";
import { resolveContentTemplate } from "../utils/resolveContentTemplate.js";

function cleanupTempFile(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

export const createVideo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "A video file is required");
  }

  const meta = videoMetaSchema.parse(req.body);
  const [uploaded, content] = await Promise.all([
    uploadVideoToImageKit(req.file),
    resolveContentTemplate(),
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
    const sheetBuffer = sheetFile.path ? await fs.promises.readFile(sheetFile.path) : sheetFile.buffer;
    rows = parseSheetFile({ ...sheetFile, buffer: sheetBuffer });
  } catch {
    throw new ApiError(400, "Could not parse the metadata file. Please use the sample template.");
  } finally {
    cleanupTempFile(sheetFile);
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
      cleanupTempFile(file);
      continue;
    }

    const parsedMeta = videoMetaSchema.safeParse({
      doctorName: row.doctorname,
      degree: row.degree,
      designation: row.designation,
      specialization: row.specialization,
      organizationName: row.organizationname,
      phone: row.phone,
    });

    if (!parsedMeta.success) {
      errors.push({
        fileName: file.originalname,
        error: parsedMeta.error.issues.map((i) => i.message).join(", "),
      });
      cleanupTempFile(file);
      continue;
    }

    try {
      const [uploaded, content] = await Promise.all([
        uploadVideoToImageKit(file),
        resolveContentTemplate(),
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
      created.push(video);
    } catch (err) {
      errors.push({ fileName: file.originalname, error: err.message || "Upload failed" });
    }
  }

  res.status(201).json({ created, errors, createdCount: created.length, errorCount: errors.length });
});

export const getSampleCsv = asyncHandler(async (req, res) => {
  const csv = [
    "fileName,doctorName,degree,designation,specialization,phone,organizationName",
    "sleep-tips.mp4,Dr. Diwakar Shukla,MBBS,Consultant,General Physician,+91 12345 67890,MediCare Clinic",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=medishare-bulk-upload-sample.csv");
  res.send(csv);
});

export const exportVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find()
    .sort({ createdAt: -1 })
    .select("doctorName degree designation phone slug uploadedByName");
  const clientUrl = (process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const rows = videos.map((video) => ({
    "Doctor Name": video.doctorName,
    Degree: video.degree,
    Designation: video.designation || "",
    "Mobile Number": video.phone,
    "Video Link": `${clientUrl}/watch/${video.slug}`,
    "Uploaded By": video.uploadedByName || "Public link",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "My Videos");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=medishare-videos.xlsx");
  res.send(buffer);
});

export const listVideos = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const search = (req.query.search || "").trim();
  const ownership = req.query.ownership || "all";
  // Phone numbers often contain "+", which is invalid at the start of a regex
  // (PCRE throws "nothing to repeat") — escape special chars before matching.
  const searchPattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filter = {};
  if (ownership === "mine") {
    filter.uploadedBy = req.admin._id;
  }

  if (search) {
    filter.$or = [
      { doctorName: { $regex: searchPattern, $options: "i" } },
      { phone: { $regex: searchPattern, $options: "i" } },
    ];
  }

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

  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // The video's own fields can feed {{variables}} in the active frame, so any
  // previously cached burned copy is stale the moment they change — clear it
  // so the next download re-renders instead of serving outdated text/branding.
  const oldCachedFileId = video.cachedRenderImagekitFileId;
  Object.assign(video, updates, {
    cachedRenderUrl: "",
    cachedRenderImagekitFileId: "",
    cachedRenderFrameVersion: "",
  });
  await video.save();
  if (oldCachedFileId) deleteFromImageKit(oldCachedFileId).catch(() => {});

  res.json({ video });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  await deleteFromImageKit(video.imagekitFileId);
  if (video.cachedRenderImagekitFileId) {
    await deleteFromImageKit(video.cachedRenderImagekitFileId);
  }
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

// GET, not POST — a plain file download. If the video already has a frame
// permanently baked in (frameBakedId) or there's no active frame to apply,
// this just redirects straight to the stored file (instant, ImageKit serves
// it). Otherwise it's an unbaked video: the first download for a given
// video+frame pairing burns the frame in, uploads the result to ImageKit,
// and remembers it (cachedRenderUrl/cachedRenderFrameVersion) so every
// later download of that same pairing just redirects to the cached file
// instantly instead of re-burning. Editing the video (updateVideo) or the
// frame (its updatedAt bumps, changing frameVersion) invalidates the cache.
export const getFramedDownload = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.frameBakedId) {
    return res.redirect(`${video.videoUrl}?ik-attachment=true`);
  }

  const frame = await getActiveFrame();
  if (!frame) {
    return res.redirect(`${video.videoUrl}?ik-attachment=true`);
  }

  const currentVersion = frameVersion(frame);
  if (video.cachedRenderUrl && video.cachedRenderFrameVersion === currentVersion) {
    return res.redirect(`${video.cachedRenderUrl}?ik-attachment=true`);
  }

  let burned;
  try {
    // Queued so at most one ffmpeg burn ever runs at a time — several
    // running together is a fast way to exceed a small container's memory,
    // even if each one alone would have been fine.
    burned = await enqueueBurn(() => burnFrameToTempFile(video.videoUrl, frame, video));
    // uploadVideoToImageKit streams from disk and deletes burned.path itself
    // once done — no separate cleanup call needed on success.
    const uploaded = await uploadVideoToImageKit({
      path: burned.path,
      originalname: `${video.slug}-framed.mp4`,
      mimetype: "video/mp4",
    });

    const oldCachedFileId = video.cachedRenderImagekitFileId;
    video.cachedRenderUrl = uploaded.url;
    video.cachedRenderImagekitFileId = uploaded.fileId;
    video.cachedRenderFrameVersion = currentVersion;
    await video.save();
    if (oldCachedFileId) deleteFromImageKit(oldCachedFileId).catch(() => {});

    return res.redirect(`${uploaded.url}?ik-attachment=true`);
  } catch (err) {
    throw new ApiError(500, err.message || "Could not prepare your download");
  } finally {
    await burned?.cleanup();
  }
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
