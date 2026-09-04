import { promises as fs, createWriteStream } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import axios from "axios";
import { buildFrameOverlaySvg } from "./renderFrameSvg.js";

ffmpeg.setFfmpegPath(ffmpegPath);

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
// <workDir>/output.mp4 and returning its path.
async function burnFrame(inputPath, frame, video, workDir) {
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
    ffmpeg(inputPath)
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
      .on("end", resolve)
      .save(outputPath);
  });

  return outputPath;
}

/**
 * Downloads the video at `sourceUrl`, burns `frame` into it, and returns the
 * result as a buffer. Never uploads or persists anything — callers decide
 * what to do with the buffer (stream it straight to a download response, or
 * upload it as a video's new primary file for a permanent re-burn).
 */
export async function burnFrameFromUrl(sourceUrl, frame, video) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-burn-"));
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
