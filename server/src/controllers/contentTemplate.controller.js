import { ContentTemplate } from "../models/ContentTemplate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { defaultTemplateSchema } from "../validators/contentTemplate.validator.js";

export const listTemplates = asyncHandler(async (req, res) => {
  const defaultTemplate = await ContentTemplate.findOne({ targetType: "all" });
  res.json({ defaultTemplate });
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
