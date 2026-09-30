import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Undo2, Redo2, Eye, Save, Upload, ZoomIn, ZoomOut } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../../../lib/api.js";
import { useFrameEditor, emptyFrame } from "./designer/useFrameEditor.js";
import { ASPECT_RATIOS, createElement } from "./designer/elementDefaults.js";
import DesignerCanvas from "./designer/DesignerCanvas.jsx";
import ElementsPanel from "./designer/ElementsPanel.jsx";
import PropertiesPanel from "./designer/PropertiesPanel.jsx";
import PreviewPanel from "./designer/PreviewPanel.jsx";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";

// New frames start with a Video Area + a doctor-name text field already on the
// canvas — an empty canvas gave no hint that these need to be added manually.
function starterElements(canvas) {
  const video = createElement("video", canvas);
  const name = createElement("text", canvas);
  name.y = Math.min(canvas.height - 80, video.y + video.height + 24);
  return [video, name];
}

function AspectRatioPicker({ onPick, onUploadDimensions }) {
  const inputRef = useRef(null);

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 p-10">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-xl font-bold text-slate-900">Create a New Frame</h1>
        <p className="mt-1.5 text-sm text-slate-500">Choose a canvas size, or upload an existing design.</p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.id}
              onClick={() => onPick(ratio)}
              className="card flex flex-col items-center gap-2 p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div
                className="rounded-md bg-slate-200"
                style={{ width: 48, height: (48 * ratio.height) / ratio.width, maxHeight: 60 }}
              />
              <span className="text-xs font-semibold text-slate-700">{ratio.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8">
          <button onClick={() => inputRef.current?.click()} className="btn-primary">
            <Upload size={16} />
            Upload Existing Frame Design
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadDimensions(file);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-xs text-slate-400">PNG, JPG, WEBP or SVG — dimensions are detected automatically.</p>
        </div>
      </div>
    </div>
  );
}

export default function FrameDesigner() {
  const { frameId } = useParams();
  const navigate = useNavigate();
  const isNew = !frameId;

  const [loading, setLoading] = useState(!isNew);
  const [needsSetup, setNeedsSetup] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.4);
  const editorRef = useRef(null);
  const [, forceRender] = useState(0);

  const editor = useFrameEditor(emptyFrame({ width: 1080, height: 1080, id: "1:1" }));
  editorRef.current = editor;

  useEffect(() => {
    if (isNew) return;
    api
      .get(`/frames/${frameId}`)
      .then(({ data }) => {
        editor.setFrameMeta(data.frame);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate(FRAME_STUDIO_BASE);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);

  const startFromRatio = (ratio) => {
    const canvas = { width: ratio.width, height: ratio.height };
    editor.setFrameMeta({
      name: `${ratio.label} Frame`,
      width: ratio.width,
      height: ratio.height,
      aspectRatio: ratio.id,
      elements: starterElements(canvas),
    });
    setNeedsSetup(false);
  };

  const startFromUpload = async (file) => {
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = URL.createObjectURL(file);
    });

    const toastId = toast.loading("Uploading frame image...");
    try {
      const data = new FormData();
      data.append("image", file);
      const { data: res } = await api.post("/frames/assets", data);
      const canvas = { width: dims.width, height: dims.height };
      editor.setFrameMeta({
        name: "Uploaded Frame",
        width: dims.width,
        height: dims.height,
        aspectRatio: "custom",
        background: { type: "image", value: res.url, fileId: res.fileId },
        elements: starterElements(canvas),
      });
      toast.success("Frame image uploaded — drag the Video Area onto the opening in your design", { id: toastId });
      setNeedsSetup(false);
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: editor.frame.name,
        width: editor.frame.width,
        height: editor.frame.height,
        aspectRatio: editor.frame.aspectRatio,
        background: editor.frame.background,
        elements: editor.frame.elements,
      };
      if (isNew) {
        const { data } = await api.post("/frames", payload);
        toast.success("Frame saved");
        navigate(`${FRAME_STUDIO_BASE}/${data.frame._id}`, { replace: true });
      } else {
        await api.patch(`/frames/${frameId}`, payload);
        toast.success("Frame saved");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const selectedElement = editor.frame.elements.find((el) => el.id === editor.selectedId) || null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(FRAME_STUDIO_BASE)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </button>
          <input
            className="rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-300 focus:outline-none"
            value={editor.frame.name}
            onChange={(e) => editor.setFrameMeta({ name: e.target.value })}
          />
        </div>

        {!needsSetup && (
          <div className="flex items-center gap-2">
            <button onClick={editor.undo} disabled={!editor.canUndo} className="btn-secondary !py-1.5" title="Undo">
              <Undo2 size={15} />
            </button>
            <button onClick={editor.redo} disabled={!editor.canRedo} className="btn-secondary !py-1.5" title="Redo">
              <Redo2 size={15} />
            </button>
            <div className="mx-1 flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-1">
              <button onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))} className="p-1 text-slate-500 hover:text-slate-800">
                <ZoomOut size={14} />
              </button>
              <span className="w-9 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="p-1 text-slate-500 hover:text-slate-800">
                <ZoomIn size={14} />
              </button>
            </div>
            <button onClick={save} disabled={saving} className="btn-primary !py-1.5">
              <Save size={15} />
              {saving ? "Saving..." : "Save Frame"}
            </button>
          </div>
        )}
      </header>

      {needsSetup ? (
        <AspectRatioPicker onPick={startFromRatio} onUploadDimensions={startFromUpload} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ElementsPanel
            frame={editor.frame}
            selectedId={editor.selectedId}
            onAddElement={editor.addElement}
            onAddImage={editor.addImageElement}
            onSetBackground={(url) => editor.setFrameMeta({ background: { type: "image", value: url } })}
            onSelect={editor.setSelectedId}
            onUpdate={editor.updateElement}
            onRemove={editor.removeElement}
            onReorder={editor.reorderElements}
          />

          <main className="flex flex-1 items-center justify-center overflow-auto p-6">
            <DesignerCanvas
              frame={editor.frame}
              selectedId={editor.selectedId}
              onSelect={editor.setSelectedId}
              onUpdate={editor.updateElement}
              onDropVariable={editor.addVariableElement}
              scale={zoom}
            />
          </main>

          {selectedElement ? (
            <PropertiesPanel
              element={selectedElement}
              onUpdate={editor.updateElement}
              onRemove={editor.removeElement}
              onDuplicate={editor.duplicateElement}
            />
          ) : (
            <PreviewPanel frame={editor.frame} />
          )}
        </div>
      )}
    </div>
  );
}
