import { useRef, useState } from "react";
import { Type, ImageIcon, Video, Square, Circle, Minus, Upload, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../../../../lib/api.js";
import { AVAILABLE_VARIABLES } from "../../../../lib/frameVariables.js";
import LayersPanel from "./LayersPanel.jsx";

const ELEMENT_BUTTONS = [
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "video", label: "Video Area", icon: Video },
  { type: "rect", label: "Rectangle", icon: Square },
  { type: "circle", label: "Circle", icon: Circle },
  { type: "line", label: "Line", icon: Minus },
];

export default function ElementsPanel({ frame, selectedId, onAddElement, onAddImage, onSetBackground, ...layerHandlers }) {
  const bgInputRef = useRef(null);
  const graphicInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file, onDone) => {
    setUploading(true);
    const data = new FormData();
    data.append("image", file);
    try {
      const { data: res } = await api.post("/frames/assets", data);
      onDone(res.url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Elements</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {ELEMENT_BUTTONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onAddElement(type)}
              title={label}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-[10px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-100 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dynamic Fields</h3>
        <p className="mt-1 text-[11px] text-slate-400">Drag one onto the canvas — it fills in from each video's info.</p>
        <div className="mt-3 space-y-1.5">
          {AVAILABLE_VARIABLES.map((v) => (
            <div
              key={v.key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-medishare-variable", v.key);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex cursor-grab items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 active:cursor-grabbing"
            >
              <GripVertical size={12} className="text-slate-400" />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-100 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Uploads</h3>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => bgInputRef.current?.click()}
            className="btn-secondary w-full justify-start !py-2 text-xs"
          >
            <Upload size={13} />
            Upload Background
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => graphicInputRef.current?.click()}
            className="btn-secondary w-full justify-start !py-2 text-xs"
          >
            <Upload size={13} />
            Upload Logo / Graphic
          </button>
        </div>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file, (url) => onSetBackground(url));
            e.target.value = "";
          }}
        />
        <input
          ref={graphicInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file, (url) => onAddImage(url));
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex-1 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Layers</h3>
        <div className="mt-3">
          <LayersPanel elements={frame.elements} selectedId={selectedId} {...layerHandlers} />
        </div>
      </div>
    </aside>
  );
}
