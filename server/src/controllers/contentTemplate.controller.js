import { ContentTemplate } from "../models/ContentTemplate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  defaultTemplateSchema,
  doctorTemplateSchema,
  doctorTemplateUpdateSchema,
} from "../validators/contentTemplate.validator.js";

export const listTemplates = asyncHandler(async (req, res) => {
  const [defaultTemplate, doctorTemplates] = await Promise.all([
    ContentTemplate.findOne({ targetType: "all" }),
    ContentTemplate.find({ targetType: "doctor" }).sort({ doctorEmail: 1 }),
  ]);

  res.json({ defaultTemplate, doctorTemplates });
});

export const upsertDefaultTemplate = asyncHandler(async (req, res) => {
  const data = defaultTemplateSchema.parse(req.body);

  const template = await ContentTemplate.findOneAndUpdate(
    { targetType: "all" },
    { targetType: "all", ...data },
    { upsert: true, new: true }
  );

  res.json({ template });
});

export const createDoctorTemplate = asyncHandler(async (req, res) => {
  const data = doctorTemplateSchema.parse(req.body);

  const existing = await ContentTemplate.findOne({ targetType: "doctor", doctorEmail: data.doctorEmail });
  if (existing) {
    throw new ApiError(409, `An override for ${data.doctorEmail} already exists — edit it instead.`);
  }

  const template = await ContentTemplate.create({ targetType: "doctor", ...data });
  res.status(201).json({ template });
});

export const updateDoctorTemplate = asyncHandler(async (req, res) => {
  const data = doctorTemplateUpdateSchema.parse(req.body);

  const template = await ContentTemplate.findOneAndUpdate(
    { _id: req.params.id, targetType: "doctor" },
    data,
    { new: true, runValidators: true }
  );
  if (!template) throw new ApiError(404, "Override not found");

  res.json({ template });
});

export const deleteDoctorTemplate = asyncHandler(async (req, res) => {
  const template = await ContentTemplate.findOneAndDelete({ _id: req.params.id, targetType: "doctor" });
  if (!template) throw new ApiError(404, "Override not found");

  res.json({ message: "Override deleted" });
});
