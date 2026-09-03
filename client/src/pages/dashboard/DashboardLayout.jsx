import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../../components/dashboard/Sidebar.jsx";
import Logo from "../../components/Logo.jsx";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 bg-navy-800 px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Logo dark />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
