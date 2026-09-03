import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  UploadCloud,
  Layers,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import Logo from "../Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Frames is intentionally not listed here — it lives at an unlisted URL.
// See client/src/App.jsx for the route.
const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/videos", label: "My Videos", icon: Video },
  { to: "/dashboard/upload", label: "Upload Video", icon: UploadCloud },
  { to: "/dashboard/bulk-upload", label: "Bulk Upload", icon: Layers },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const ENV_BADGE = {
  staging: { label: "STAGING", className: "bg-amber-400 text-amber-950" },
  development: { label: "DEV", className: "bg-slate-500 text-white" },
};

export default function Sidebar() {
  const { logout } = useAuth();
  const appEnv = import.meta.env.VITE_APP_ENV || "development";
  const badge = ENV_BADGE[appEnv];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-navy-800 px-4 py-6">
      <div className="flex items-center justify-between px-2">
        <Logo dark />
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
      >
        <LogOut size={18} />
        Logout
      </button>
    </aside>
  );
}
