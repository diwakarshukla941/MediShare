import { Play } from "lucide-react";

export default function Logo({ dark = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <Play size={16} fill="currentColor" />
      </span>
      <span className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
        MediShare
      </span>
    </div>
  );
}
