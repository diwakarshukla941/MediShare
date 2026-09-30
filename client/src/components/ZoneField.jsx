import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { api } from "../lib/api.js";

export default function ZoneField({ value, onChange, disabled = false }) {
  const [zones, setZones] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const filteredZones = useMemo(
    () => zones.filter((zone) => zone.name.toLowerCase().includes(value.toLowerCase())),
    [zones, value]
  );

  useEffect(() => {
    api.get("/zones").then(({ data }) => setZones(data.zones || [])).catch(() => setZones([]));
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectZone = (name) => {
    onChange({ target: { value: name } });
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="label">Zone</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9 pr-9"
          required
          placeholder="Search a city"
          value={value}
          onChange={onChange}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
          aria-label="Show zones"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filteredZones.length ? (
            filteredZones.map((zone) => (
              <button
                key={zone._id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                onClick={() => selectZone(zone.name)}
              >
                {zone.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-400">No matching zone found.</p>
          )}
        </div>
      )}
    </div>
  );
}
