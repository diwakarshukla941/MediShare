import { resolveVariables } from "./resolveVariables.js";

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Rough average glyph width as a fraction of font size — good enough for
// wrapping text inside a fixed box without needing real font metrics.
const CHAR_WIDTH_RATIO = 0.56;

function wrapText(text, boxWidth, fontSize, maxLines = 8) {
  const maxChars = Math.max(1, Math.floor(boxWidth / (fontSize * CHAR_WIDTH_RATIO)));
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function rotateTransform(el) {
  if (!el.rotation) return "";
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return ` transform="rotate(${el.rotation} ${cx} ${cy})"`;
}

function textAnchorFor(align) {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}

function textXFor(el, align) {
  const padding = el.padding || 0;
  if (align === "left") return el.x + padding;
  if (align === "right") return el.x + el.width - padding;
  return el.x + el.width / 2;
}

function renderTextElement(el, video) {
  const content = resolveVariables(el.content || "", video);
  if (!content) return "";

  const fontSize = el.fontSize || 24;
  const align = el.align || "center";
  const padding = el.padding || 0;
  const lineHeight = el.lineHeight || fontSize * 1.25;
  const anchor = textAnchorFor(align);
  const textX = textXFor(el, align);
  const lines = wrapText(content, el.width - padding * 2, fontSize);
  const totalTextHeight = lines.length * lineHeight;
  const startY = el.y + Math.max(padding, (el.height - totalTextHeight) / 2) + fontSize;

  const bg =
    el.background && el.background !== "transparent"
      ? `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius || 0}" fill="${el.background}" />`
      : "";

  const border =
    el.border?.width > 0
      ? `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius || 0}" fill="none" stroke="${el.border.color || "#000"}" stroke-width="${el.border.width}" />`
      : "";

  const tspans = lines
    .map((line, i) => `<tspan x="${textX}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  return `
    <g opacity="${el.opacity ?? 1}"${rotateTransform(el)}>
      ${bg}
      <text font-family="${escapeXml(el.fontFamily || "Arial")}, Liberation Sans, Noto Sans, sans-serif" font-size="${fontSize}"
        font-weight="${el.fontWeight || 400}" fill="${el.color || "#111827"}" text-anchor="${anchor}"
        letter-spacing="${el.letterSpacing || 0}">${tspans}</text>
      ${border}
    </g>`;
}

function renderImageElement(el, imageDataUriMap) {
  const dataUri = imageDataUriMap.get(el.src);
  if (!dataUri) return "";
  const clipId = `clip-${el.id}`;
  const clip =
    el.borderRadius > 0
      ? `<clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius}" /></clipPath>`
      : "";
  const border =
    el.border?.width > 0
      ? `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius || 0}" fill="none" stroke="${el.border.color || "#000"}" stroke-width="${el.border.width}" />`
      : "";

  return `
    <g opacity="${el.opacity ?? 1}"${rotateTransform(el)}>
      ${clip}
      <image href="${dataUri}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}"
        preserveAspectRatio="${el.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"
        ${el.borderRadius > 0 ? `clip-path="url(#${clipId})"` : ""} />
      ${border}
    </g>`;
}

function renderShapeElement(el) {
  const stroke = el.stroke?.width > 0 ? `stroke="${el.stroke.color || "#000"}" stroke-width="${el.stroke.width}"` : "";
  const fill = el.fill || "none";

  if (el.type === "circle") {
    const rx = el.width / 2;
    const ry = el.height / 2;
    return `<g opacity="${el.opacity ?? 1}"${rotateTransform(el)}><ellipse cx="${el.x + rx}" cy="${el.y + ry}" rx="${rx}" ry="${ry}" fill="${fill}" ${stroke} /></g>`;
  }
  if (el.type === "line") {
    return `<g opacity="${el.opacity ?? 1}"${rotateTransform(el)}><line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" ${stroke || `stroke="${el.color || "#000"}" stroke-width="2"`} /></g>`;
  }
  return `<g opacity="${el.opacity ?? 1}"${rotateTransform(el)}><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius || 0}" fill="${fill}" ${stroke} /></g>`;
}

/**
 * Builds the SVG overlay burned into the final video: everything except the
 * video element itself, which instead punches a transparent hole (via mask)
 * so the actual video frame shows through when composited by ffmpeg.
 *
 * @param {object} frame - Frame doc-like object { width, height, background, elements }
 * @param {object} video - Video doc-like object, used to resolve {{variables}}
 * @param {Map<string,string>} imageDataUriMap - src URL -> base64 data URI, pre-fetched
 * @param {object|null} videoElement - the element of type "video" (window rect), or null
 */
export function buildFrameOverlaySvg(frame, video, imageDataUriMap = new Map(), videoElement = null, { dynamicTextOnly = false } = {}) {
  const { width: W, height: H } = frame;

  // Older baked files may predate dynamic-field rendering. This mode draws
  // only variable-backed text over the existing baked frame, without adding
  // a second background or nesting the existing video inside another frame.
  if (dynamicTextOnly) {
    const dynamicText = (frame.elements || [])
      .filter((el) => !el.hidden && el.type === "text" && /\{\{\s*\w+\s*\}\}/.test(el.content || ""))
      .map((el) => renderTextElement(el, video))
      .join("\n");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${dynamicText}</svg>`;
  }

  const backgroundLayer =
    frame.background?.type === "image" && imageDataUriMap.has(frame.background.value)
      ? `<image href="${imageDataUriMap.get(frame.background.value)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" />`
      : `<rect width="${W}" height="${H}" fill="${frame.background?.value || "#eef2ff"}" />`;

  const visibleElements = (frame.elements || []).filter((el) => !el.hidden && el.type !== "video");

  const elementsMarkup = visibleElements
    .map((el) => {
      if (el.type === "text") return renderTextElement(el, video);
      if (el.type === "image") return renderImageElement(el, imageDataUriMap);
      return renderShapeElement(el);
    })
    .join("\n");

  const maskDef = videoElement
    ? `<mask id="videoHole"><rect width="${W}" height="${H}" fill="white" />
         <rect x="${videoElement.x}" y="${videoElement.y}" width="${videoElement.width}" height="${videoElement.height}"
           rx="${videoElement.borderRadius || 0}" fill="black" /></mask>`
    : "";

  const videoBorder =
    videoElement?.border?.width > 0
      ? `<rect x="${videoElement.x}" y="${videoElement.y}" width="${videoElement.width}" height="${videoElement.height}"
           rx="${videoElement.borderRadius || 0}" fill="none" stroke="${videoElement.border.color || "#000"}"
           stroke-width="${videoElement.border.width}" />`
      : "";

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${maskDef}</defs>
  <g ${videoElement ? 'mask="url(#videoHole)"' : ""}>
    ${backgroundLayer}
    ${elementsMarkup}
  </g>
  ${videoBorder}
</svg>`;
}
