import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  UploadCloud,
  Layers,
  BarChart3,
  Settings,
  LogOut,
  X,
  Wand2,
  FileText,
  Users,
  MapPin,
  HardDrive,
} from "lucide-react";
import Logo from "../Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../lib/accessPermissions.js";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";

// Each entry shows only if the logged-in account holds that permission
// (super_admin always holds everything). `permission: null` means always shown.
const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, permission: null },
  { to: "/dashboard/videos", label: "My Videos", icon: Video, permission: "videos:view" },
  { to: "/dashboard/upload", label: "Upload Video", icon: UploadCloud, permission: "videos:upload" },
  { to: "/dashboard/bulk-upload", label: "Bulk Upload", icon: Layers, superAdminOnly: true },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" },
  { to: FRAME_STUDIO_BASE, label: "Frame Studio", icon: Wand2, permission: "frames:manage" },
  {
    to: `${FRAME_STUDIO_BASE}/content-templates`,
    label: "Content Templates",
    icon: FileText,
    permission: "content_templates:manage",
  },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, permission: null },
  { to: "/dashboard/team", label: "Team & Access", icon: Users, permission: "team:manage" },
  { to: "/dashboard/zones", label: "Zones", icon: MapPin, superAdminOnly: true },
  { to: "/dashboard/storage", label: "Storage & CDN", icon: HardDrive, superAdminOnly: true },
];

const ENV_BADGE = {
  staging: { label: "STAGING", className: "bg-amber-400 text-amber-950" },
  development: { label: "DEV", className: "bg-slate-500 text-white" },
};

// Static & visible on desktop (md+); a slide-in overlay drawer on mobile,
// controlled by `open`/`onClose` from DashboardLayout's hamburger button.
export default function Sidebar({ open, onClose }) {
  const { logout, admin } = useAuth();
  const appEnv = import.meta.env.VITE_APP_ENV || "development";
  const badge = ENV_BADGE[appEnv];
  const navLinks = links.filter(
    (l) => (!l.permission || hasPermission(admin, l.permission)) && (!l.superAdminOnly || admin?.role === "super_admin")
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col bg-navy-800 px-4 py-6 transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Logo dark />
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${badge.className}`}>
                {badge.label}
              </span>
            )}
            <button onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 md:hidden">
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
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
    </>
  );
}
