import { resolveVariables } from "../lib/frameVariables.js";

const pct = (value, total) => `${(value / total) * 100}%`;
const cqw = (value, total) => `${(value / total) * 100}cqw`;

function rotateStyle(el) {
  return el.rotation ? { transform: `rotate(${el.rotation}deg)` } : undefined;
}

function TextElement({ el, video, frame }) {
  const content = resolveVariables(el.content || "", video);
  if (!content) return null;

  return (
    <div
      className="absolute flex whitespace-pre-wrap break-words"
      style={{
        left: pct(el.x, frame.width),
        top: pct(el.y, frame.height),
        width: pct(el.width, frame.width),
        height: pct(el.height, frame.height),
        opacity: el.opacity ?? 1,
        fontFamily: el.fontFamily || "Arial, sans-serif",
        fontSize: cqw(el.fontSize || 24, frame.width),
        fontWeight: el.fontWeight || 400,
        color: el.color || "#111827",
        textAlign: el.align || "center",
        alignItems: "center",
        justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
        lineHeight: el.lineHeight ? `${el.lineHeight / (el.fontSize || 24)}` : 1.25,
        letterSpacing: cqw(el.letterSpacing || 0, frame.width),
        background: el.background || "transparent",
        border: el.border?.width ? `${cqw(el.border.width, frame.width)} solid ${el.border.color || "#000"}` : undefined,
        borderRadius: cqw(el.borderRadius || 0, frame.width),
        padding: cqw(el.padding || 0, frame.width),
        ...rotateStyle(el),
      }}
    >
      <span className="w-full">{content}</span>
    </div>
  );
}

function ImageElement({ el, frame }) {
  if (!el.src) return null;
  return (
    <img
      src={el.src}
      alt=""
      className="absolute"
      style={{
        left: pct(el.x, frame.width),
        top: pct(el.y, frame.height),
        width: pct(el.width, frame.width),
        height: pct(el.height, frame.height),
        opacity: el.opacity ?? 1,
        objectFit: el.objectFit === "contain" ? "contain" : "cover",
        borderRadius: cqw(el.borderRadius || 0, frame.width),
        border: el.border?.width ? `${cqw(el.border.width, frame.width)} solid ${el.border.color || "#000"}` : undefined,
        ...rotateStyle(el),
      }}
    />
  );
}

function ShapeElement({ el, frame }) {
  const base = {
    left: pct(el.x, frame.width),
    top: pct(el.y, frame.height),
    width: pct(el.width, frame.width),
    height: pct(el.height, frame.height),
    opacity: el.opacity ?? 1,
    ...rotateStyle(el),
  };

  if (el.type === "circle") {
    return (
      <div
        className="absolute rounded-full"
        style={{
          ...base,
          background: el.fill || "transparent",
          border: el.stroke?.width ? `${cqw(el.stroke.width, frame.width)} solid ${el.stroke.color || "#000"}` : undefined,
        }}
      />
    );
  }
  if (el.type === "line") {
    return (
      <svg className="absolute overflow-visible" style={{ ...base, pointerEvents: "none" }}>
        <line
          x1="0"
          y1="0"
          x2="100%"
          y2="100%"
          stroke={el.stroke?.color || el.color || "#000"}
          strokeWidth={el.stroke?.width || 2}
        />
      </svg>
    );
  }
  return (
    <div
      className="absolute"
      style={{
        ...base,
        background: el.fill || "transparent",
        borderRadius: cqw(el.borderRadius || 0, frame.width),
        border: el.stroke?.width ? `${cqw(el.stroke.width, frame.width)} solid ${el.stroke.color || "#000"}` : undefined,
      }}
    />
  );
}

/**
 * Generic, data-driven live renderer for a Frame doc. Used by the public
 * watch page (with a real playing <video> as children) and the Frame
 * Designer's preview panel. Geometry comes entirely from `frame` — no
 * hardcoded layout — so any client-designed frame renders correctly.
 */
export default function FrameRenderer({ frame, video, children }) {
  if (!frame) {
    // No frame to overlay — let the content (a <video>) size itself at its
    // own natural aspect ratio instead of forcing a fixed box, so square,
    // portrait, and landscape videos all display correctly (see WatchVideo.jsx).
    return (
      <div className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-lg">
        {children}
      </div>
    );
  }

  const elements = (frame.elements || []).filter((el) => !el.hidden);
  const videoEl = elements.find((el) => el.type === "video");

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl shadow-lg"
      style={{
        aspectRatio: `${frame.width} / ${frame.height}`,
        containerType: "inline-size",
        background:
          frame.background?.type === "image" && frame.background.value
            ? `center / cover no-repeat url(${frame.background.value})`
            : frame.background?.value || "#eef2ff",
      }}
    >
      {elements.map((el) => {
        if (el.type === "video") {
          return (
            <div
              key={el.id}
              className="absolute overflow-hidden bg-black"
              style={{
                left: pct(el.x, frame.width),
                top: pct(el.y, frame.height),
                width: pct(el.width, frame.width),
                height: pct(el.height, frame.height),
                borderRadius: cqw(el.borderRadius || 0, frame.width),
                border: el.border?.width ? `${cqw(el.border.width, frame.width)} solid ${el.border.color || "#000"}` : undefined,
              }}
            >
              {children}
            </div>
          );
        }
        if (el.type === "text") return <TextElement key={el.id} el={el} video={video} frame={frame} />;
        if (el.type === "image") return <ImageElement key={el.id} el={el} frame={frame} />;
        return <ShapeElement key={el.id} el={el} frame={frame} />;
      })}
      {!videoEl && children}
    </div>
  );
}
