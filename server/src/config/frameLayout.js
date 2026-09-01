// Shared geometry for the branded video frame — used both to rasterize the
// server-side overlay (for the downloadable composed video) and, in ratio
// form, by the client's live on-screen frame renderer. Keep the two in sync.
export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

export const VIDEO_WINDOW = { x: 90, y: 210, w: 900, h: 900 };
export const BADGE = { cy: 90, h: 76 };
export const NAME_PILL = { y: 1140, h: 60 };
export const CAPTION_BOX = { y: 1215, h: 110 };
export const CORNER_LOGO = { cx: 995, cy: 1295, r: 55 };
export const APPOINTMENT_PILL = { x: 90, y: 1140, w: 340, h: 60 };

export const FRAME_PRESETS = {
  azure: { from: "#eaf2ff", to: "#a9c8fb", ring: "#5b9bf7", text: "#0f2f66" },
  violet: { from: "#f1ecfe", to: "#c7b3f8", ring: "#9a6df0", text: "#33206b" },
  emerald: { from: "#e8fbf1", to: "#a7e9c6", ring: "#3fbf7f", text: "#0f4a30" },
  slate: { from: "#eef1f5", to: "#c3ccd6", ring: "#8592a3", text: "#1f2733" },
};

export const FRAME_PRESET_IDS = Object.keys(FRAME_PRESETS);
