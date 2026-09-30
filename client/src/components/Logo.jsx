import { Play } from "lucide-react";
import { brand } from "../config/brand.js";

export default function Logo({ dark = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {brand.logoSrc ? (
        <img src={brand.logoSrc} alt={brand.logoAlt} className="h-12 w-auto object-contain object-left" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm" aria-hidden="true">
          <Play size={16} fill="currentColor" />
        </span>
      )}
      {!brand.logoSrc && <span className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>{brand.name}</span>}
    </div>
  );
}
