import { promises as fs, createWriteStream } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import axios from "axios";
import { buildFrameOverlaySvg } from "./renderFrameSvg.js";
import { getImageKit, imagekitFolder } from "../config/imagekit.js";

ffmpeg.setFfmpegPath(ffmpegPath);

export function frameVersion(frame) {
  return `${frame._id}-${new Date(frame.updatedAt).getTime()}`;
}

async function downloadToFile(url, destPath) {
  const response = await axios.get(url, { responseType: "stream", timeout: 120000 });
  const writer = createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function fetchAsDataUri(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  const mime = res.headers["content-type"] || "image/png";
  return `data:${mime};base64,${Buffer.from(res.data).toString("base64")}`;
}

async function buildImageDataUriMap(frame) {
  const urls = new Set();
  if (frame.background?.type === "image" && frame.background.value) urls.add(frame.background.value);
  for (const el of frame.elements || []) {
    if (el.type === "image" && el.src && !el.hidden) urls.add(el.src);
  }

  const map = new Map();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        map.set(url, await fetchAsDataUri(url));
      } catch (err) {
        console.error(`Failed to fetch frame image ${url}:`, err.message);
      }
    })
  );
  return map;
}

// Burns `frame` into the video at `inputPath`, writing the result to
// <workDir>/output.mp4 and returning its path. Shared by both the
// URL-based (on-demand, legacy) and buffer-based (upload-time) callers below.
async function burnFrame(inputPath, frame, video, workDir, onProgress) {
  const videoElement = (frame.elements || []).find((el) => el.type === "video" && !el.hidden);
  if (!videoElement) {
    throw new Error("This frame has no Video Area element — add one before activating it.");
  }

  const overlayPath = path.join(workDir, "overlay.png");
  const outputPath = path.join(workDir, "output.mp4");

  const imageDataUriMap = await buildImageDataUriMap(frame);
  const svg = buildFrameOverlaySvg(frame, video, imageDataUriMap, videoElement);
  await sharp(Buffer.from(svg)).png().toFile(overlayPath);

  const { x: vx, y: vy, width: vw, height: vh, objectFit } = videoElement;
  const { width: CW, height: CH } = frame;

  const fitFilter =
    objectFit === "contain"
      ? `scale=${vw}:${vh}:force_original_aspect_ratio=decrease,pad=${vw}:${vh}:(ow-iw)/2:(oh-ih)/2:color=black`
      : `scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh}`;

  await new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]${fitFilter},pad=${CW}:${CH}:${vx}:${vy}:color=black[padded]`,
        `[padded][1:v]overlay=0:0:format=auto[out]`,
      ])
      .outputOptions([
        "-map",
        "[out]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
      ])
      .on("error", reject)
      .on("end", resolve);

    if (onProgress) {
      command.on("progress", (p) => {
        if (typeof p.percent === "number") onProgress(Math.min(99, Math.max(0, Math.round(p.percent))));
      });
    }

    command.save(outputPath);
  });

  return outputPath;
}

/**
 * Burns `frame` into `video`'s original file via ffmpeg, uploads the result
 * to ImageKit, and returns its URL/fileId. Does not touch the Video document —
 * callers (server/src/utils/renderQueue.js) own persisting the result.
 *
 * This is the legacy/on-demand path: downloads the original from ImageKit
 * first. New uploads instead burn the frame in synchronously at upload time
 * (see burnFrameFromBuffer below), which skips this download entirely.
 */
export async function composeFramedVideo(video, frame, { onProgress } = {}) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-render-"));
  const inputPath = path.join(workDir, "input.mp4");

  try {
    await downloadToFile(video.videoUrl, inputPath);
    const outputPath = await burnFrame(inputPath, frame, video, workDir, onProgress);

    const outputBuffer = await fs.readFile(outputPath);
    const imagekit = getImageKit();
    const uploaded = await imagekit.upload({
      file: outputBuffer,
      fileName: `${video.slug}-framed.mp4`,
      folder: imagekitFolder("rendered"),
      useUniqueFileName: true,
    });

    return { url: uploaded.url, fileId: uploaded.fileId };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Burns `frame` into a video file already sitting in memory (the raw
 * upload buffer, before it's ever touched ImageKit) and returns the
 * resulting MP4 as a buffer. Used at upload time so the final stored file
 * already has the frame baked in — no separate original + rendered copy,
 * and no need to re-download anything from ImageKit to do it.
 */
export async function burnFrameFromBuffer(fileBuffer, frame, video, sourceExt = ".mp4") {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-upload-render-"));
  const inputPath = path.join(workDir, `input${sourceExt}`);

  try {
    await fs.writeFile(inputPath, fileBuffer);
    const outputPath = await burnFrame(inputPath, frame, video, workDir);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Downloads the video at `sourceUrl`, burns `frame` into it, and returns the
 * result as a buffer (does not upload anywhere). Used by the super-admin-only
 * "re-burn existing videos" tool (server/src/controllers/frame.controller.js)
 * to convert a still-unbaked video (one with a clean original) into a baked
 * one — the caller is responsible for uploading the buffer as the video's
 * new primary file and deleting the old one, so storage never doubles.
 */
export async function burnFrameFromUrl(sourceUrl, frame, video) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-rebake-"));
  const ext = path.extname(new URL(sourceUrl).pathname).split("?")[0] || ".mp4";
  const inputPath = path.join(workDir, `input${ext}`);

  try {
    await downloadToFile(sourceUrl, inputPath);
    const outputPath = await burnFrame(inputPath, frame, video, workDir);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
