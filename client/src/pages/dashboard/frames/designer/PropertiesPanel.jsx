import { Trash2, Copy } from "lucide-react";
import { FONT_OPTIONS } from "./elementDefaults.js";
import { AVAILABLE_VARIABLES } from "../../../../lib/frameVariables.js";

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, ...props }) {
  return (
    <input
      type="number"
      className="input !py-1.5 text-xs"
      value={Number.isFinite(value) ? Math.round(value) : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      {...props}
    />
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-slate-200"
      />
      <input className="input !py-1.5 text-xs" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function PropertiesPanel({ element, onUpdate, onRemove, onDuplicate }) {
  if (!element) return null;
  const set = (patch) => onUpdate(element.id, patch);
  const setNested = (key, patch) => onUpdate(element.id, { [key]: { ...element[key], ...patch } });

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <input
          className="input !py-1.5 text-sm font-semibold"
          value={element.name || ""}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Field label="X">
          <NumberInput value={element.x} onChange={(v) => set({ x: v })} />
        </Field>
        <Field label="Y">
          <NumberInput value={element.y} onChange={(v) => set({ y: v })} />
        </Field>
        <Field label="Width">
          <NumberInput value={element.width} onChange={(v) => set({ width: Math.max(10, v) })} />
        </Field>
        <Field label="Height">
          <NumberInput value={element.height} onChange={(v) => set({ height: Math.max(10, v) })} />
        </Field>
        <Field label="Rotation">
          <NumberInput value={element.rotation} onChange={(v) => set({ rotation: v })} />
        </Field>
        <Field label="Opacity">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="input !py-1.5 text-xs"
            value={element.opacity ?? 1}
            onChange={(e) => set({ opacity: Math.min(1, Math.max(0, Number(e.target.value))) })}
          />
        </Field>
      </div>

      {element.type === "text" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Field label="Text Content">
            <textarea
              className="input text-xs"
              rows={2}
              value={element.content || ""}
              onChange={(e) => set({ content: e.target.value })}
            />
          </Field>
          <Field label="Insert Variable">
            <select
              className="input !py-1.5 text-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) set({ content: `${element.content || ""}{{${e.target.value}}}` });
              }}
            >
              <option value="">Choose a variable...</option>
              {AVAILABLE_VARIABLES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Font">
              <select
                className="input !py-1.5 text-xs"
                value={element.fontFamily || "Inter"}
                onChange={(e) => set({ fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weight">
              <select
                className="input !py-1.5 text-xs"
                value={element.fontWeight || 400}
                onChange={(e) => set({ fontWeight: Number(e.target.value) })}
              >
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Size">
              <NumberInput value={element.fontSize} onChange={(v) => set({ fontSize: Math.max(6, v) })} />
            </Field>
            <Field label="Line Height">
              <NumberInput value={element.lineHeight} onChange={(v) => set({ lineHeight: Math.max(6, v) })} />
            </Field>
            <Field label="Letter Spacing">
              <NumberInput value={element.letterSpacing} onChange={(v) => set({ letterSpacing: v })} />
            </Field>
            <Field label="Padding">
              <NumberInput value={element.padding} onChange={(v) => set({ padding: Math.max(0, v) })} />
            </Field>
            <Field label="Align">
              <select className="input !py-1.5 text-xs" value={element.align || "center"} onChange={(e) => set({ align: e.target.value })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Field>
            <Field label="Border Radius">
              <NumberInput value={element.borderRadius} onChange={(v) => set({ borderRadius: Math.max(0, v) })} />
            </Field>
          </div>
          <Field label="Color">
            <ColorInput value={element.color} onChange={(v) => set({ color: v })} />
          </Field>
          <Field label="Background">
            <ColorInput value={element.background === "transparent" ? "" : element.background} onChange={(v) => set({ background: v || "transparent" })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Border Width">
              <NumberInput value={element.border?.width || 0} onChange={(v) => setNested("border", { width: Math.max(0, v) })} />
            </Field>
            <Field label="Border Color">
              <ColorInput value={element.border?.color} onChange={(v) => setNested("border", { color: v })} />
            </Field>
          </div>
        </div>
      )}

      {element.type === "image" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Field label="Object Fit">
            <select className="input !py-1.5 text-xs" value={element.objectFit || "cover"} onChange={(e) => set({ objectFit: e.target.value })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </Field>
          <Field label="Border Radius">
            <NumberInput value={element.borderRadius} onChange={(v) => set({ borderRadius: Math.max(0, v) })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Border Width">
              <NumberInput value={element.border?.width || 0} onChange={(v) => setNested("border", { width: Math.max(0, v) })} />
            </Field>
            <Field label="Border Color">
              <ColorInput value={element.border?.color} onChange={(v) => setNested("border", { color: v })} />
            </Field>
          </div>
        </div>
      )}

      {element.type === "video" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            This defines exactly where the doctor's video plays inside the frame. Rotation isn't supported for this
            element in the final rendered download — keep it at 0°.
          </p>
          <Field label="Object Fit">
            <select className="input !py-1.5 text-xs" value={element.objectFit || "cover"} onChange={(e) => set({ objectFit: e.target.value })}>
              <option value="cover">Cover (crop to fill)</option>
              <option value="contain">Contain (fit, may letterbox)</option>
            </select>
          </Field>
          <Field label="Border Radius">
            <NumberInput value={element.borderRadius} onChange={(v) => set({ borderRadius: Math.max(0, v) })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Border Width">
              <NumberInput value={element.border?.width || 0} onChange={(v) => setNested("border", { width: Math.max(0, v) })} />
            </Field>
            <Field label="Border Color">
              <ColorInput value={element.border?.color} onChange={(v) => setNested("border", { color: v })} />
            </Field>
          </div>
        </div>
      )}

      {(element.type === "rect" || element.type === "circle") && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Field label="Fill">
            <ColorInput value={element.fill} onChange={(v) => set({ fill: v })} />
          </Field>
          {element.type === "rect" && (
            <Field label="Border Radius">
              <NumberInput value={element.borderRadius} onChange={(v) => set({ borderRadius: Math.max(0, v) })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Stroke Width">
              <NumberInput value={element.stroke?.width || 0} onChange={(v) => setNested("stroke", { width: Math.max(0, v) })} />
            </Field>
            <Field label="Stroke Color">
              <ColorInput value={element.stroke?.color} onChange={(v) => setNested("stroke", { color: v })} />
            </Field>
          </div>
        </div>
      )}

      {element.type === "line" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Thickness">
              <NumberInput value={element.stroke?.width || 2} onChange={(v) => setNested("stroke", { width: Math.max(1, v) })} />
            </Field>
            <Field label="Color">
              <ColorInput value={element.stroke?.color} onChange={(v) => setNested("stroke", { color: v })} />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
        <button onClick={() => onDuplicate(element.id)} className="btn-secondary flex-1 !py-2 text-xs">
          <Copy size={13} />
          Duplicate
        </button>
        <button
          onClick={() => onRemove(element.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </aside>
  );
}
