import multer from "multer";
import os from "os";
import crypto from "crypto";
import path from "path";
import { ApiError } from "../utils/ApiError.js";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB per video
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

// Videos land on disk as they're received, instead of being buffered fully
// in memory — on a 512MB container, a single large video (or several in a
// bulk batch) held as an in-memory Buffer is an easy way to run out of
// memory. uploadVideoToImageKit streams straight from these temp files and
// deletes them once done (see server/src/utils/uploadToImageKit.js).
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => cb(null, `medishare-upload-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname)}`),
});

// Small, bounded files (CSV/Excel sheets, frame images) stay in memory —
// nowhere near large enough to matter, and simpler to read directly.
const memoryStorage = multer.memoryStorage();

function videoFileFilter(req, file, cb) {
  if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}. Use MP4, MOV, AVI or WEBM.`));
    return;
  }
  cb(null, true);
}

export const uploadSingleVideo = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: videoFileFilter,
}).single("video");

const SHEET_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export const uploadBulk = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 201 },
  fileFilter(req, file, cb) {
    if (file.fieldname === "sheet") {
      const name = file.originalname.toLowerCase();
      if (!SHEET_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        cb(new ApiError(400, "The metadata file must be a .csv, .xlsx or .xls file"));
        return;
      }
      cb(null, true);
      return;
    }
    videoFileFilter(req, file, cb);
  },
}).fields([
  { name: "videos", maxCount: 200 },
  { name: "sheet", maxCount: 1 },
]);

const MAX_SHEET_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadSheet = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_SHEET_SIZE },
  fileFilter(req, file, cb) {
    const name = file.originalname.toLowerCase();
    if (!SHEET_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      cb(new ApiError(400, "File must be a .csv, .xlsx or .xls file"));
      return;
    }
    cb(null, true);
  },
}).single("sheet");

export const uploadFrameImage = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, `Unsupported image type: ${file.mimetype}. Use PNG, JPG or WEBP.`));
      return;
    }
    cb(null, true);
  },
}).single("image");
