import archiver from "archiver";
import crypto from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { BulkDownloadJob } from "../models/BulkDownloadJob.js";
import { Video } from "../models/Video.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteStoredFile, getArchiveDownloadUrl, getArchiveObjectKey, getStoredVideoStream, uploadArchiveStream } from "../storage/provider.js";

let pumping = false;
let pumpTimer = null;

function safeSegment(value) {
  return String(value || "Unassigned").replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 100);
}

function jobResponse(job, downloadUrl = "") {
  return {
    job: {
      id: job._id,
      zone: job.zone,
      status: job.status,
      totalVideos: job.totalVideos,
      processedVideos: job.processedVideos,
      error: job.error,
      downloadUrl,
    },
  };
}

async function removeExpiredArchives() {
  const expired = await BulkDownloadJob.find({ status: "completed", expiresAt: { $lte: new Date() }, archiveKey: { $ne: "" } }).select("_id archiveKey");
  for (const job of expired) {
    try {
      await deleteStoredFile(job.archiveKey, "r2");
    } catch (error) {
      console.error("Expired archive cleanup failed:", error.message);
      continue;
    }
    await job.deleteOne();
  }
}

async function appendVideo(archive, video) {
  const stream = await getStoredVideoStream(video.videoUrl, video.imagekitFileId, video.storageProvider);

  const zone = safeSegment(video.zone);
  const doctor = safeSegment(video.doctorName || "video");
  const extension = path.extname(video.fileName || "").toLowerCase() || ".mp4";
  const entryName = `${zone}/${doctor}-${video._id}${extension}`;
  const nodeStream = stream instanceof Readable ? stream : Readable.fromWeb(stream);

  await new Promise((resolve, reject) => {
    const onEntry = () => finish();
    const onError = (error) => finish(error);
    const finish = (error) => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
      nodeStream.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    archive.once("entry", onEntry);
    archive.once("error", onError);
    nodeStream.once("error", onError);
    archive.append(nodeStream, { name: entryName });
  });
}

async function buildArchive(job) {
  const filter = {};
  if (job.zone !== "all") filter.zone = job.zone;
  const archiveKey = await getArchiveObjectKey(`${job._id}-${crypto.randomUUID()}.zip`);
  const archive = archiver("zip", { zlib: { level: 0 } });
  let archiveFailure;
  archive.on("error", (error) => { archiveFailure = error; });
  archive.on("warning", (error) => {
    if (error.code === "ENOENT") {
      archiveFailure = error;
      archive.destroy(error);
    } else {
      console.warn("Video archive warning:", error.message);
    }
  });
  const uploadPromise = uploadArchiveStream(archive, archiveKey, Math.max(8 * 1024 * 1024, Math.ceil(job.totalBytes / 9000)));
  uploadPromise.catch((error) => {
    archiveFailure = error;
    archive.destroy(error);
  });

  let processedVideos = 0;
  const cursor = Video.find(filter).sort({ zone: 1, createdAt: 1 }).select("_id zone doctorName videoUrl imagekitFileId storageProvider fileName").lean().cursor();
  try {
    for await (const video of cursor) {
      if (archiveFailure) throw archiveFailure;
      await appendVideo(archive, video);
      processedVideos += 1;
      if (processedVideos % 10 === 0 || processedVideos === job.totalVideos) {
        await BulkDownloadJob.updateOne({ _id: job._id, status: "processing" }, { processedVideos, lockUntil: new Date(Date.now() + 60_000) });
      }
    }
    if (archiveFailure) throw archiveFailure;
    if (!processedVideos) throw new Error("No completed videos were found for this selection");
    await archive.finalize();
    await uploadPromise;
    await BulkDownloadJob.updateOne({ _id: job._id }, {
      status: "completed",
      processedVideos,
      archiveKey,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      lockUntil: null,
      error: "",
    });
  } catch (error) {
    cursor.close().catch(() => {});
    archive.destroy(error);
    await uploadPromise.catch(() => {});
    await deleteStoredFile(archiveKey, "r2").catch(() => {});
    throw error;
  }
}

async function pumpJobs() {
  if (pumping) return;
  pumping = true;
  try {
    await removeExpiredArchives();
    while (true) {
      const now = new Date();
      const job = await BulkDownloadJob.findOneAndUpdate(
        { $or: [{ status: "queued" }, { status: "processing", lockUntil: { $lte: now } }] },
        { status: "processing", lockUntil: new Date(Date.now() + 60_000), error: "" },
        { new: true, sort: { createdAt: 1 } }
      );
      if (!job) break;

      const heartbeat = setInterval(() => {
        BulkDownloadJob.updateOne({ _id: job._id, status: "processing" }, { lockUntil: new Date(Date.now() + 60_000) }).catch(() => {});
      }, 20_000);
      heartbeat.unref();
      try {
        await buildArchive(job);
      } catch (error) {
        await BulkDownloadJob.updateOne({ _id: job._id }, {
          status: "failed",
          lockUntil: null,
          error: (error.message || "Archive generation failed").slice(0, 500),
        });
      } finally {
        clearInterval(heartbeat);
      }
    }
  } catch (error) {
    console.error("Bulk download worker failed:", error.message);
  } finally {
    pumping = false;
    if (pumpTimer) clearTimeout(pumpTimer);
    pumpTimer = setTimeout(pumpJobs, 45_000);
    pumpTimer.unref();
  }
}

export async function resumeBulkDownloadJobs() {
  await removeExpiredArchives();
  setImmediate(pumpJobs);
}

export const createBulkDownload = asyncHandler(async (req, res) => {
  const zone = String(req.body?.zone || "all").trim() || "all";
  const filter = {};
  if (zone !== "all") filter.zone = zone;
  const totalVideos = await Video.countDocuments(filter);
  if (!totalVideos) throw new ApiError(404, "No videos found for this zone");
  const [sizeStats] = await Video.aggregate([
    { $match: filter },
    { $group: { _id: null, totalBytes: { $sum: "$fileSize" } } },
  ]);

  await removeExpiredArchives();
  const archiveZone = safeSegment(zone === "all" ? "all-zones" : zone);
  const job = await BulkDownloadJob.create({
    zone,
    totalVideos,
    totalBytes: sizeStats?.totalBytes || 0,
    archiveName: `bonconnect-videos-${archiveZone}.zip`,
    createdBy: req.admin._id,
  });
  setImmediate(pumpJobs);
  res.status(202).json(jobResponse(job));
});

export const getBulkDownloadStatus = asyncHandler(async (req, res) => {
  const job = await BulkDownloadJob.findById(req.params.jobId);
  if (!job) throw new ApiError(404, "Download job not found or expired");
  let downloadUrl = "";
  if (job.status === "completed") downloadUrl = await getArchiveDownloadUrl(job.archiveKey, job.archiveName);
  res.json(jobResponse(job, downloadUrl));
});
