import { ApiError } from "../utils/ApiError.js";
import multer from "multer";

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  if (err?.code === 11000) {
    return res.status(409).json({ message: "A record with these details already exists." });
  }

  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
}
