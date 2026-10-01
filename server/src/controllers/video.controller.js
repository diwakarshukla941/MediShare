import fs from "fs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import * as XLSX from "xlsx";
import { parseSheetFile } from "../utils/parseSheetFile.js";
import { Video } from "../models/Video.js";
import { Admin } from "../models/Admin.js";
import { Zone } from "../models/Zone.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadVideo, deleteStoredFile, getRenderableUrl, getVideoDownloadUrl, createDirectVideoUpload, verifyDirectVideoUpload, promoteDirectVideoUpload } from "../storage/provider.js";
import { videoMetaSchema, videoUpdateSchema } from "../validators/video.validator.js";
import { detectDevice } from "../utils/detectDevice.js";
import { getActiveFrame } from "../models/Frame.js";
import { burnFrameToTempFile, burnLocalVideoToTempFile, frameVersion } from "../utils/composeFramedVideo.js";
import { enqueueBurn } from "../utils/burnQueue.js";

function cleanupTempFile(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

async function assertValidZone(zone) {
  if (!(await Zone.exists({ name: zone }))) throw new ApiError(400, "Select a valid zone from the list");
}

async function burnActiveFrameOnSave(video) {
  const frame = await getActiveFrame();
  if (!frame) {
    video.renderingStatus = "completed";
    await video.save();
    return video;
  }

  let burned;
  try {
    burned = await enqueueBurn(async () => burnFrameToTempFile(await getRenderableUrl(video.sourceVideoUrl || video.videoUrl, video.sourceFileId || video.imagekitFileId, video.sourceStorageProvider || video.storageProvider), frame, video));
    const uploaded = await uploadVideo({
      path: burned.path,
      originalname: `${video.slug}-framed.mp4`,
      mimetype: "video/mp4",
    });
    const previousBakedFileId = video.imagekitFileId;
    video.videoUrl = uploaded.url;
    video.thumbnailUrl = uploaded.thumbnailUrl || video.thumbnailUrl;
    video.imagekitFileId = uploaded.fileId;
    video.storageProvider = uploaded.provider;
    video.fileName = uploaded.name;
    video.fileSize = uploaded.size;
    video.frameBakedId = frame._id;
    video.renderingStatus = "completed";
    video.renderingError = "";
    await video.save();
    if (previousBakedFileId && previousBakedFileId !== video.sourceFileId) await deleteStoredFile(previousBakedFileId, video.storageProvider);
    return video;
  } catch (error) {
    video.renderingStatus = "failed";
    video.renderingError = (error.message || "Could not burn the active frame into this video").slice(0, 500);
    await video.save();
  } finally {
    await burned?.cleanup();
  }
}

function queueBurn(videoId) {
  Video.findById(videoId)
    .then((video) => video && burnActiveFrameOnSave(video))
    .catch((error) => console.error("Video render failed:", error.message));
}

const queueRendersInCloudflare = () => process.env.RENDER_JOBS_VIA_CLOUDFLARE_QUEUE === "true";

function scheduleVideoRender(videoId) {
  if (!queueRendersInCloudflare()) queueBurn(videoId);
}

export async function processVideoRenderJob(videoId) {
  const now = new Date();
  const video = await Video.findOneAndUpdate({
    _id: videoId,
    renderingStatus: { $in: ["processing", "failed"] },
    $or: [{ renderLeaseUntil: null }, { renderLeaseUntil: { $lte: now } }],
  }, { $set: { renderingStatus: "processing", renderingError: "", renderLeaseUntil: new Date(Date.now() + 10 * 60_000) } }, { new: true });
  if (!video) return { skipped: true };

  const heartbeat = setInterval(() => {
    Video.updateOne({ _id: video._id, renderingStatus: "processing" }, { renderLeaseUntil: new Date(Date.now() + 10 * 60_000) }).catch(() => {});
  }, 60_000);
  heartbeat.unref();
  try {
    await burnActiveFrameOnSave(video);
    const finished = await Video.findById(video._id).select("renderingStatus renderingError").lean();
    if (finished?.renderingStatus === "failed") throw new Error(finished.renderingError || "Frame rendering failed");
    return { status: finished?.renderingStatus || "completed" };
  } finally {
    clearInterval(heartbeat);
    await Video.updateOne({ _id: video._id }, { renderLeaseUntil: null });
  }
}

const DIRECT_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]);
const MAX_DIRECT_VIDEO_SIZE = 500 * 1024 * 1024;

export const createVideoUploadIntent = asyncHandler(async (req, res) => {
  const meta = videoMetaSchema.parse(req.body?.metadata || {});
  const file = req.body?.file || {};
  const originalname = String(file.name || "").replace(/[\\/\r\n]/g, "_").slice(0, 200);
  const mimetype = String(file.type || "").toLowerCase();
  const size = Number(file.size);
  if (!originalname || !DIRECT_VIDEO_TYPES.has(mimetype)) throw new ApiError(400, "Choose an MP4, MOV, AVI or WEBM video");
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_DIRECT_VIDEO_SIZE) throw new ApiError(400, "Video must be between 1 byte and 500 MB");
  await assertValidZone(meta.zone);

  const intentId = crypto.randomUUID();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError(503, "Video uploads are not configured: JWT_SECRET is missing");
  const target = await createDirectVideoUpload({ originalname, mimetype, intentId });
  const uploadToken = jwt.sign({
    intentId,
    key: target.key,
    meta,
    originalname,
    mimetype,
    size,
    adminId: req.admin?._id?.toString() || "",
    source: req.admin ? "dashboard" : "public",
  }, secret, { expiresIn: "20m", audience: "video-upload", issuer: "bonconnect-api" });

  res.status(201).json({ uploadUrl: target.uploadUrl, fileId: target.key, headers: target.headers, uploadToken });
});

export const completeDirectVideoUpload = asyncHandler(async (req, res) => {
  const token = String(req.body?.uploadToken || "");
  if (!token) throw new ApiError(400, "Upload completion token is required");
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError(503, "Video uploads are not configured: JWT_SECRET is missing");

  let intent;
  try {
    intent = jwt.verify(token, secret, { audience: "video-upload", issuer: "bonconnect-api" });
  } catch {
    throw new ApiError(401, "Upload authorization expired. Start the upload again.");
  }

  const existing = await Video.findOne({ uploadIntentId: intent.intentId });
  if (existing) {
    deleteStoredFile(intent.key, "r2").catch(() => {});
    return res.status(200).json({ video: existing, slug: existing.slug, watchPath: `/watch/${existing.slug}` });
  }

  let verified;
  try {
    verified = await verifyDirectVideoUpload(intent.key, intent.intentId, intent.size, intent.mimetype);
  } catch (error) {
    throw new ApiError(400, error.name === "NotFound" ? "The video has not finished uploading to R2" : error.message || "Could not verify the R2 upload");
  }

  let video;
  try {
    const source = await promoteDirectVideoUpload(intent.key, intent.intentId, intent.originalname);
    const activeFrame = await getActiveFrame();
    const uploader = intent.adminId
      ? await Admin.findById(intent.adminId).select("name email location").lean()
      : null;
    video = await Video.create({
      ...intent.meta,
      videoUrl: source.url,
      sourceVideoUrl: source.url,
      sourceFileId: source.key,
      sourceStorageProvider: "r2",
      uploadIntentId: intent.intentId,
      thumbnailUrl: "",
      imagekitFileId: source.key,
      storageProvider: "r2",
      fileName: intent.originalname,
      fileSize: verified.size,
      frameBakedId: null,
      renderingStatus: activeFrame ? "processing" : "completed",
      renderingError: "",
      source: intent.source,
      uploadedBy: intent.adminId || null,
      uploadedByName: uploader?.name || "",
      uploadedByEmail: uploader?.email || "",
      uploadedByLocation: uploader?.location || "",
    });
    deleteStoredFile(intent.key, "r2").catch((error) => console.error("Temporary R2 upload cleanup failed:", error.message));
    if (activeFrame) scheduleVideoRender(video._id);
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Video.findOne({ uploadIntentId: intent.intentId });
      if (duplicate) {
        deleteStoredFile(intent.key, "r2").catch(() => {});
        return res.status(200).json({ video: duplicate, slug: duplicate.slug, watchPath: `/watch/${duplicate.slug}` });
      }
    }
    throw error;
  }

  res.status(201).json({ video, slug: video.slug, watchPath: `/watch/${video.slug}` });
});

async function uploadBurnedVideo(file, meta, frame) {
  if (!frame) return { uploaded: await uploadVideo(file), frame: null };

  let burned;
  try {
    burned = await enqueueBurn(() => burnLocalVideoToTempFile(file.path, frame, meta));
    const outputStats = await fs.promises.stat(burned.path);
    const uploaded = await uploadVideo({
      path: burned.path,
      originalname: `${file.originalname.replace(/\.[^.]+$/, "")}-framed.mp4`,
      mimetype: "video/mp4",
      size: outputStats.size,
    });
    return { uploaded, frame };
  } finally {
    cleanupTempFile(file);
    await burned?.cleanup();
  }
}

// Local development resumes the in-process work queue at boot. Production
// render jobs are recovered by the Cloudflare Queue repair scan instead.
export async function resumeProcessingVideos() {
  const pending = await Video.find({ renderingStatus: "processing" }).select("_id").lean();
  if (!queueRendersInCloudflare()) {
    for (const video of pending) queueBurn(video._id);
  }
  return pending.length;
}

export const createVideo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "A video file is required");
  }

  let meta;
  let result;
  try {
    meta = videoMetaSchema.parse(req.body);
    await assertValidZone(meta.zone);
    result = await uploadBurnedVideo(req.file, meta, await getActiveFrame());
  } catch (error) {
    cleanupTempFile(req.file);
    throw error;
  }
  const { uploaded, frame } = result;

  const video = await Video.create({
    ...meta,
    videoUrl: uploaded.url,
    sourceVideoUrl: "",
    sourceFileId: "",
    sourceStorageProvider: uploaded.provider,
    thumbnailUrl: uploaded.thumbnailUrl,
    imagekitFileId: uploaded.fileId,
    storageProvider: uploaded.provider,
    fileName: uploaded.name,
    fileSize: uploaded.size,
    frameBakedId: frame?._id || null,
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
      credentials: row.credentials,
      empId: row.empid,
      zone: row.zone,
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
      await assertValidZone(parsedMeta.data.zone);
    } catch (err) {
      errors.push({ fileName: file.originalname, error: err.message });
      cleanupTempFile(file);
      continue;
    }

    try {
      const { uploaded, frame } = await uploadBurnedVideo(file, parsedMeta.data, await getActiveFrame());
      const video = await Video.create({
        ...parsedMeta.data,
        videoUrl: uploaded.url,
        sourceVideoUrl: "",
        sourceFileId: "",
        sourceStorageProvider: uploaded.provider,
        thumbnailUrl: uploaded.thumbnailUrl,
        imagekitFileId: uploaded.fileId,
        storageProvider: uploaded.provider,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        frameBakedId: frame?._id || null,
        renderingStatus: "completed",
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
    "fileName,doctorName,credentials,empId,zone,phone",
    "sleep-tips.mp4,Dr. Diwakar Shukla,MBBS,EMP-001,Mumbai,+91 12345 67890",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=medishare-bulk-upload-sample.csv");
  res.send(csv);
});

export const exportVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find()
    .sort({ createdAt: -1 })
    .select("doctorName credentials empId zone phone slug uploadedByName");
  const clientUrl = (process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const rows = videos.map((video) => ({
    "Doctor Name": video.doctorName,
    Credentials: video.credentials,
    "Employee ID": video.empId,
    Zone: video.zone,
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
  if (video.renderingStatus === "failed") throw new ApiError(500, video.renderingError || "Video processing failed");

  AnalyticsEvent.create({
    video: video._id,
    eventType: "view",
    sessionId: typeof req.query.sid === "string" ? req.query.sid.slice(0, 64) : "",
    device: detectDevice(req.headers["user-agent"]),
  }).catch((err) => console.error("Failed to log view event:", err.message));

  res.json({ video });
});

export const getPublicVideoStatus = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ slug: req.params.slug }).select("renderingStatus renderingError");
  if (!video) throw new ApiError(404, "Video not found");
  res.json({ renderingStatus: video.renderingStatus, renderingError: video.renderingError });
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
  if (updates.zone) await assertValidZone(updates.zone);

  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (video.renderingStatus === "processing") throw new ApiError(409, "Wait for the current video render to finish before editing its details");

  // The video's own fields can feed {{variables}} in the active frame, so any
  // previously cached burned copy is stale the moment they change — clear it
  // so the next download re-renders instead of serving outdated text/branding.
  const oldCachedFileId = video.cachedRenderImagekitFileId;
  Object.assign(video, updates, {
    cachedRenderUrl: "",
    cachedRenderImagekitFileId: "",
    cachedRenderFrameVersion: "",
  });
  if (!video.sourceVideoUrl) throw new ApiError(409, "This older video has no original source available. Upload it again to update its details.");
  video.renderingStatus = "processing";
  video.renderingError = "";
  await video.save();
  scheduleVideoRender(video._id);
  if (oldCachedFileId) deleteStoredFile(oldCachedFileId, video.storageProvider).catch(() => {});

  res.json({ video });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  await deleteStoredFile(video.imagekitFileId, video.storageProvider);
  if (video.sourceFileId && video.sourceFileId !== video.imagekitFileId) {
    await deleteStoredFile(video.sourceFileId, video.sourceStorageProvider);
  }
  if (video.cachedRenderImagekitFileId) {
    await deleteStoredFile(video.cachedRenderImagekitFileId, video.storageProvider);
  }
  await video.deleteOne();
  AnalyticsEvent.deleteMany({ video: video._id }).catch((err) =>
    console.error("Failed to clean up analytics events:", err.message)
  );

  res.json({ message: "Video deleted successfully" });
});

// Intentionally super-admin-only at the route. Deletion is permanent: remove
// the stored render/source reference, video document, and its analytics data.
export const bulkDeleteVideos = asyncHandler(async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [])].slice(0, 100);
  if (!ids.length) throw new ApiError(400, "Select at least one video to delete");
  const videos = await Video.find({ _id: { $in: ids } });
  await Promise.all(videos.map(async (video) => {
    await deleteStoredFile(video.imagekitFileId, video.storageProvider);
    if (video.sourceFileId && video.sourceFileId !== video.imagekitFileId) {
      await deleteStoredFile(video.sourceFileId, video.sourceStorageProvider);
    }
    if (video.cachedRenderImagekitFileId) await deleteStoredFile(video.cachedRenderImagekitFileId, video.storageProvider);
    await video.deleteOne();
    AnalyticsEvent.deleteMany({ video: video._id }).catch((err) => console.error("Failed to clean up analytics events:", err.message));
  }));
  res.json({ message: `${videos.length} video(s) deleted`, deletedCount: videos.length });
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

// Prepare a short-lived direct download URL. R2 files use a signed GET with
// Content-Disposition so the browser navigates directly to storage instead
// of fetching a cross-origin redirect as a blob, which depends on R2 CORS.
// Unbaked videos render once per active-frame version and reuse the stored
// result for later downloads.
export const getFramedDownload = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.renderingStatus !== "completed") throw new ApiError(425, "This video is still being processed");

  const frame = await getActiveFrame();
  const filename = `${video.doctorName || "video"}.mp4`;
  if (!frame) {
    const downloadUrl = await getVideoDownloadUrl(video.videoUrl, video.imagekitFileId, video.storageProvider, filename);
    return res.json({ downloadUrl });
  }

  const bakedFrameMatches = video.frameBakedId && String(video.frameBakedId) === String(frame._id);
  if (video.frameBakedId && !bakedFrameMatches) {
    const downloadUrl = await getVideoDownloadUrl(video.videoUrl, video.imagekitFileId, video.storageProvider, filename);
    return res.json({ downloadUrl });
  }

  const hasDynamicText = (frame.elements || []).some((el) =>
    !el.hidden && el.type === "text" && /\{\{\s*\w+\s*\}\}/.test(el.content || "")
  );
  if (bakedFrameMatches && !hasDynamicText) {
    const downloadUrl = await getVideoDownloadUrl(video.videoUrl, video.imagekitFileId, video.storageProvider, filename);
    return res.json({ downloadUrl });
  }

  const currentVersion = frameVersion(frame);
  if (video.cachedRenderUrl && video.cachedRenderFrameVersion === currentVersion) {
    const downloadUrl = await getVideoDownloadUrl(video.cachedRenderUrl, video.cachedRenderImagekitFileId, video.storageProvider, filename);
    return res.json({ downloadUrl });
  }

  let burned;
  try {
    // Queued so at most one ffmpeg burn ever runs at a time — several
    // running together is a fast way to exceed a small container's memory,
    // even if each one alone would have been fine.
    burned = await enqueueBurn(() => burnFrameToTempFile(video.videoUrl, frame, video, {
      dynamicTextOnly: Boolean(bakedFrameMatches),
    }));
    // Stream the finished file into R2, then cache it for later downloads.
    const uploaded = await uploadVideo({
      path: burned.path,
      originalname: `${video.slug}-framed.mp4`,
      mimetype: "video/mp4",
    });

    const oldCachedFileId = video.cachedRenderImagekitFileId;
    video.cachedRenderUrl = uploaded.url;
    video.cachedRenderImagekitFileId = uploaded.fileId;
    video.cachedRenderFrameVersion = currentVersion;
    await video.save();
    if (oldCachedFileId) deleteStoredFile(oldCachedFileId, video.storageProvider).catch(() => {});

    const downloadUrl = await getVideoDownloadUrl(uploaded.url, uploaded.fileId, uploaded.provider, filename);
    return res.json({ downloadUrl });
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

  const topVideos = await Video.find().sort({ views: -1 }).limit(8).select("title doctorName credentials views shareCount slug");

  res.json({
    totalVideos: agg?.totalVideos || 0,
    totalViews: agg?.totalViews || 0,
    totalShares: agg?.totalShares || 0,
    storageUsed: agg?.storageUsed || 0,
    topVideos,
  });
});
