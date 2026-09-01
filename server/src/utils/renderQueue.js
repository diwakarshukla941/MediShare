import PQueue from "p-queue";
import { Video } from "../models/Video.js";
import { getActiveFrame } from "../models/Frame.js";
import { composeFramedVideo, frameVersion } from "./composeFramedVideo.js";
import { deleteFromImageKit } from "./uploadToImageKit.js";

const queue = new PQueue({ concurrency: 2 });

async function renderOne(videoId) {
  const frame = await getActiveFrame();
  if (!frame) return;

  const video = await Video.findById(videoId);
  if (!video) return;

  const version = frameVersion(frame);
  if (video.renderingStatus === "completed" && video.renderedFrameVersion === version) {
    return; // already rendered against this exact frame version
  }

  video.renderingStatus = "processing";
  video.renderProgress = 0;
  video.renderingError = "";
  await video.save();

  const oldFileId = video.renderedImagekitFileId;

  try {
    const { url, fileId } = await composeFramedVideo(video, frame, {
      onProgress: (pct) => {
        Video.updateOne({ _id: videoId }, { renderProgress: pct }).catch(() => {});
      },
    });

    await Video.updateOne(
      { _id: videoId },
      {
        renderedUrl: url,
        renderedImagekitFileId: fileId,
        renderedFrameId: frame._id,
        renderedFrameVersion: version,
        renderingStatus: "completed",
        renderProgress: 100,
        renderingError: "",
      }
    );

    if (oldFileId) deleteFromImageKit(oldFileId).catch(() => {});
  } catch (err) {
    console.error(`Render failed for video ${videoId}:`, err.message);
    await Video.updateOne(
      { _id: videoId },
      { renderingStatus: "failed", renderingError: (err.message || "Render failed").slice(0, 500) }
    );
  }
}

export function enqueueRender(videoId) {
  return queue.add(() => renderOne(videoId));
}

export async function enqueueRenderForAllVideos() {
  const videos = await Video.find().select("_id");
  videos.forEach((v) => enqueueRender(v._id));
  return videos.length;
}
