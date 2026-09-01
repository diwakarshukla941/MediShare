import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical, Video, Type, ImageIcon, Square, Circle, Minus } from "lucide-react";

const ICONS = { video: Video, text: Type, image: ImageIcon, rect: Square, circle: Circle, line: Minus };

export default function LayersPanel({ elements, selectedId, onSelect, onUpdate, onRemove, onReorder }) {
  const [dragId, setDragId] = useState(null);
  // Render topmost (last in array = drawn last = visually on top) first in the list.
  const ordered = [...elements].reverse();

  return (
    <div className="space-y-1">
      {ordered.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">No elements yet — add one above.</p>}
      {ordered.map((el) => {
        const Icon = ICONS[el.type] || Square;
        const active = el.id === selectedId;
        return (
          <div
            key={el.id}
            draggable
            onDragStart={() => setDragId(el.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId && dragId !== el.id) onReorder(dragId, el.id);
              setDragId(null);
            }}
            onClick={() => onSelect(el.id)}
            className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <GripVertical size={13} className="shrink-0 cursor-grab text-slate-300" />
            <Icon size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{el.name || el.type}</span>
            <button
              type="button"
              title={el.hidden ? "Show" : "Hide"}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(el.id, { hidden: !el.hidden });
              }}
              className="rounded p-1 opacity-0 hover:bg-slate-200 group-hover:opacity-100"
            >
              {el.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              type="button"
              title={el.locked ? "Unlock" : "Lock"}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(el.id, { locked: !el.locked });
              }}
              className="rounded p-1 opacity-0 hover:bg-slate-200 group-hover:opacity-100"
            >
              {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(el.id);
              }}
              className="rounded p-1 text-red-500 opacity-0 hover:bg-red-50 group-hover:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
