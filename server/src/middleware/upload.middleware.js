import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB per video
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const storage = multer.memoryStorage();

function videoFileFilter(req, file, cb) {
  if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}. Use MP4, MOV, AVI or WEBM.`));
    return;
  }
  cb(null, true);
}

export const uploadSingleVideo = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: videoFileFilter,
}).single("video");

export const uploadBulk = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 21 },
  fileFilter(req, file, cb) {
    if (file.fieldname === "csv") {
      if (file.mimetype !== "text/csv" && !file.originalname.toLowerCase().endsWith(".csv")) {
        cb(new ApiError(400, "The metadata file must be a .csv file"));
        return;
      }
      cb(null, true);
      return;
    }
    videoFileFilter(req, file, cb);
  },
}).fields([
  { name: "videos", maxCount: 20 },
  { name: "csv", maxCount: 1 },
]);

export const uploadFrameImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, `Unsupported image type: ${file.mimetype}. Use PNG, JPG or WEBP.`));
      return;
    }
    cb(null, true);
  },
}).single("image");
