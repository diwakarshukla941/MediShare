import { useAuth } from "../../context/AuthContext.jsx";

export default function Topbar({ title, subtitle }) {
  const { admin } = useAuth();
  const initial = admin?.name?.[0]?.toUpperCase() || "A";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-8 sm:py-5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-1.5 sm:pr-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initial}
          </span>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{admin?.name}</p>
            <p className="text-xs text-slate-500">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
