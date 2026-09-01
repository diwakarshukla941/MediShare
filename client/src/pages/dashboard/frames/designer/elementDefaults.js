let counter = 0;
export function newId(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

const common = () => ({ rotation: 0, opacity: 1, hidden: false, locked: false });

export function createElement(type, canvas) {
  const cx = Math.round(canvas.width / 2);
  const cy = Math.round(canvas.height / 2);

  switch (type) {
    case "video":
      return {
        id: newId("video"),
        type: "video",
        name: "Video Area",
        x: Math.round(canvas.width * 0.1),
        y: Math.round(canvas.height * 0.15),
        width: Math.round(canvas.width * 0.8),
        height: Math.round(canvas.height * 0.55),
        objectFit: "cover",
        borderRadius: 0,
        border: { width: 0, color: "#0B5E8E" },
        ...common(),
      };
    case "text":
      return {
        id: newId("text"),
        type: "text",
        name: "Text",
        x: Math.round(canvas.width * 0.1),
        y: cy,
        width: Math.round(canvas.width * 0.8),
        height: 60,
        content: "{{doctorName}}",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 700,
        color: "#111827",
        align: "center",
        lineHeight: 40,
        letterSpacing: 0,
        background: "transparent",
        border: { width: 0, color: "#000000" },
        borderRadius: 0,
        padding: 8,
        ...common(),
      };
    case "image":
      return {
        id: newId("image"),
        type: "image",
        name: "Image",
        x: cx - 60,
        y: 40,
        width: 120,
        height: 120,
        src: "",
        objectFit: "cover",
        borderRadius: 0,
        border: { width: 0, color: "#000000" },
        ...common(),
      };
    case "rect":
      return {
        id: newId("rect"),
        type: "rect",
        name: "Rectangle",
        x: cx - 100,
        y: cy - 60,
        width: 200,
        height: 120,
        fill: "#2563eb",
        stroke: { width: 0, color: "#000000" },
        borderRadius: 12,
        ...common(),
      };
    case "circle":
      return {
        id: newId("circle"),
        type: "circle",
        name: "Circle",
        x: cx - 60,
        y: cy - 60,
        width: 120,
        height: 120,
        fill: "#2563eb",
        stroke: { width: 0, color: "#000000" },
        ...common(),
      };
    case "line":
      return {
        id: newId("line"),
        type: "line",
        name: "Line",
        x: cx - 100,
        y: cy,
        width: 200,
        height: 0,
        stroke: { width: 3, color: "#111827" },
        ...common(),
      };
    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

export const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Playfair Display",
  "Arial",
  "Georgia",
];

export const ASPECT_RATIOS = [
  { id: "1:1", label: "Square 1:1", width: 1080, height: 1080 },
  { id: "9:16", label: "Portrait 9:16", width: 1080, height: 1920 },
  { id: "16:9", label: "Landscape 16:9", width: 1920, height: 1080 },
  { id: "4:5", label: "Portrait 4:5", width: 1080, height: 1350 },
  { id: "custom", label: "Custom", width: 1080, height: 1080 },
];
