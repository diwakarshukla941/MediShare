import PQueue from "p-queue";
import { Video } from "../models/Video.js";
import { getActiveFrame } from "../models/Frame.js";
import { composeFramedVideo, frameVersion } from "./composeFramedVideo.js";
import { deleteFromImageKit } from "./uploadToImageKit.js";

const queue = new PQueue({ concurrency: 2 });

const RESET_FIELDS = {
  renderingStatus: "none",
  renderedUrl: "",
  renderedImagekitFileId: "",
  renderedFrameId: null,
  renderedFrameVersion: "",
  renderProgress: 0,
  renderingError: "",
};

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

// Renders on demand — called when a download is actually requested (see
// getFramedDownload) or after an edit invalidates a video's current render.
// Deliberately NOT called on every upload or frame activation: the watch
// page always plays the original file with a live CSS overlay (see
// FrameRenderer/WatchVideo.jsx), so a burned-in copy is only ever needed
// for the "Download with frame" button — rendering it for every video
// upfront would double storage for videos nobody downloads.
export function enqueueRender(videoId) {
  return queue.add(() => renderOne(videoId));
}

// Drops a video's existing rendered copy (if any) and resets it to "none"
// so the next download request renders fresh. Used when the video's own
// text fields change (doctorName/title/etc. can feed {{variables}}).
export async function invalidateRender(videoId) {
  const video = await Video.findById(videoId).select("renderedImagekitFileId");
  if (!video) return;
  if (video.renderedImagekitFileId) await deleteFromImageKit(video.renderedImagekitFileId);
  await Video.updateOne({ _id: videoId }, RESET_FIELDS);
}

// Same, but for every video — used when a new frame is activated, since
// every existing rendered copy was burned in against the old frame.
export async function invalidateAllRenderedVideos() {
  const stale = await Video.find({ renderedImagekitFileId: { $ne: "" } }).select("_id renderedImagekitFileId");
  await Promise.all(stale.map((v) => deleteFromImageKit(v.renderedImagekitFileId)));
  await Video.updateMany({}, RESET_FIELDS);
  return stale.length;
}
