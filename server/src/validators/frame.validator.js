import { z } from "zod";

const ELEMENT_TYPES = ["text", "image", "video", "rect", "circle", "line"];

// Element shape varies a lot by type (text has font props, shapes have fill/stroke,
// etc.) — validate the common geometry strictly and allow type-specific extras
// through via passthrough rather than modeling every variant here.
export const elementSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(ELEMENT_TYPES),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().default(0),
    opacity: z.number().min(0).max(1).default(1),
    hidden: z.boolean().default(false),
    locked: z.boolean().default(false),
    name: z.string().optional().default(""),
  })
  .passthrough();

export const frameCreateSchema = z.object({
  name: z.string().trim().min(1, "Frame name is required").max(80),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.string().default("custom"),
  background: z
    .object({
      type: z.enum(["color", "image"]).default("color"),
      value: z.string().default("#eef2ff"),
      imagekitFileId: z.string().optional().default(""),
    })
    .default({ type: "color", value: "#eef2ff" }),
  elements: z.array(elementSchema).default([]),
});

export const frameUpdateSchema = frameCreateSchema.partial();

export function assertExactlyOneVideoElement(elements) {
  const videoEls = elements.filter((e) => e.type === "video" && !e.hidden);
  return videoEls.length === 1 ? videoEls[0] : null;
}
