import { promises as fs, createWriteStream } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import axios from "axios";
import { buildFrameOverlaySvg } from "./renderFrameSvg.js";

ffmpeg.setFfmpegPath(ffmpegPath);

// Identifies a specific frame design at a specific point in time — changes
// whenever the frame is edited (updatedAt) or a different frame is
// activated (different _id). Used as the render-cache key so an unbaked
// video's cached download is only ever reused while it still matches
// exactly what's currently active.
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

// Frame background/element images are whatever resolution the admin
// happened to upload (easily several MB / thousands of pixels), but only
// ever need to fill a box of `targetWidth` x `targetHeight`. Embedding the
// original at full size means sharp rasterizes it, and ffmpeg composites
// it onto every video frame, at that oversized resolution — a real memory
// cost on a small container. Shrinking it down first (never upscaling)
// fixes that without changing how it looks: the SVG's own
// preserveAspectRatio still handles the actual cover/contain fit.
async function fetchAsDataUri(url, targetWidth, targetHeight) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  const mime = res.headers["content-type"] || "image/png";
  let buffer = Buffer.from(res.data);

  if (targetWidth > 0 && targetHeight > 0) {
    try {
      buffer = await sharp(buffer)
        .resize(Math.ceil(targetWidth), Math.ceil(targetHeight), { fit: "inside", withoutEnlargement: true })
        .toBuffer();
    } catch {
      // Not an image sharp can decode (or already small enough) — use as-is.
    }
  }

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function buildImageDataUriMap(frame) {
  // url -> largest box it's actually displayed in, so a background image
  // shared with a smaller thumbnail still gets fetched at the bigger size.
  const targets = new Map();
  const consider = (url, width, height) => {
    if (!url) return;
    const existing = targets.get(url);
    if (!existing || width * height > existing.width * existing.height) {
      targets.set(url, { width, height });
    }
  };

  if (frame.background?.type === "image" && frame.background.value) {
    consider(frame.background.value, frame.width, frame.height);
  }
  for (const el of frame.elements || []) {
    if (el.type === "image" && el.src && !el.hidden) consider(el.src, el.width, el.height);
  }

  const map = new Map();
  await Promise.all(
    Array.from(targets.entries()).map(async ([url, { width, height }]) => {
      try {
        map.set(url, await fetchAsDataUri(url, width, height));
      } catch (err) {
        console.error(`Failed to fetch frame image ${url}:`, err.message);
      }
    })
  );
  return map;
}

// Burns `frame` into the video at `inputPath`, writing the result to
// <workDir>/output.mp4 and returning its path.
function toEven(n) {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

async function burnFrame(inputPath, frame, video, workDir) {
  const rawVideoElement = (frame.elements || []).find((el) => el.type === "video" && !el.hidden);
  if (!rawVideoElement) {
    throw new Error("This frame has no Video Area element — add one before activating it.");
  }

  // The designer stores free-form float positions (drag-and-drop), but
  // ffmpeg's filter graph — and -pix_fmt yuv420p in particular — needs
  // integer, even-dimensioned geometry for the FINAL encoded canvas size.
  // CW/CH below are only ever used in the ffmpeg filter graph, not passed
  // to the SVG renderer — `frame` here is a Mongoose document, and
  // spreading it (`{...frame, width, height}`) silently drops nested
  // fields like `background` and `elements` (Mongoose documents don't
  // spread like plain objects), which quietly broke every frame's
  // background/text. The 1px (at most) size difference between the SVG
  // canvas and the padded ffmpeg canvas is visually a non-issue.
  const CW = toEven(frame.width);
  const CH = toEven(frame.height);
  const videoElement = {
    ...rawVideoElement,
    x: Math.round(rawVideoElement.x),
    y: Math.round(rawVideoElement.y),
    width: Math.round(rawVideoElement.width),
    height: Math.round(rawVideoElement.height),
  };

  const overlayPath = path.join(workDir, "overlay.png");
  const outputPath = path.join(workDir, "output.mp4");

  const imageDataUriMap = await buildImageDataUriMap(frame);
  const svg = buildFrameOverlaySvg(frame, video, imageDataUriMap, videoElement);
  await sharp(Buffer.from(svg)).png().toFile(overlayPath);

  const { x: vx, y: vy, width: vw, height: vh, objectFit } = videoElement;

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
        // Without this, overlaying an RGBA PNG lets ffmpeg pick the filter
        // graph's own pixel format (often yuv444p/High-4:4:4), which most
        // consumer players (Windows Media Player, many phones/TVs) can't
        // play at all ("unsupported format"). yuv420p is the universally
        // compatible baseline every player supports.
        "-pix_fmt",
        "yuv420p",
        // ffmpeg is a separate OS process but still counts against the same
        // container memory limit as Node. "fast" keeps a multi-frame
        // lookahead buffer for better compression, which costs real RAM on
        // a small instance; "ultrafast" uses the least memory and CPU
        // libx264 offers, at the cost of a somewhat larger output file for
        // the same quality — worth it to stop OOM-killing the whole server.
        "-preset",
        "ultrafast",
        "-threads",
        "1",
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
 * Downloads the video at `sourceUrl`, burns `frame` into it, and leaves the
 * result sitting on disk — returns { path, cleanup() }. Deliberately never
 * reads the output into a Buffer: on a memory-constrained server, holding a
 * whole video in RAM is exactly what crashes the process (see the OOM fix
 * this came from). Callers must call cleanup() once they're done with the
 * file (stream it to a download response, or upload it from disk for a
 * permanent re-burn) — it deletes the whole temp work directory.
 */
export async function burnFrameToTempFile(sourceUrl, frame, video) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "medishare-burn-"));
  const ext = path.extname(new URL(sourceUrl).pathname).split("?")[0] || ".mp4";
  const inputPath = path.join(workDir, `input${ext}`);
  const cleanup = () => fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

  try {
    await downloadToFile(sourceUrl, inputPath);
    const outputPath = await burnFrame(inputPath, frame, video, workDir);
    return { path: outputPath, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
