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

/**
 * Burns `frame` into `video`'s original file via ffmpeg, uploads the result
 * to ImageKit, and returns its URL/fileId. Does not touch the Video document —
 * callers (server/src/utils/renderQueue.js) own persisting the result.
 */
export async function composeFramedVideo(video, frame, { onProgress } = {}) {
  const videoElement = (frame.elements || []).find((el) => el.type === "video" && !el.hidden);
  if (!videoElement) {
    throw new Error("This frame has no Video Area element — add one before activating it.");
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-render-"));
  const inputPath = path.join(workDir, "input.mp4");
  const overlayPath = path.join(workDir, "overlay.png");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    const [imageDataUriMap] = await Promise.all([buildImageDataUriMap(frame), downloadToFile(video.videoUrl, inputPath)]);

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
