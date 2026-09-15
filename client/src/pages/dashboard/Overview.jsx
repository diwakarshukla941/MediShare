import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Video, Eye, Share2, HardDrive, UploadCloud, Layers, ArrowRight } from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import StatCard from "../../components/StatCard.jsx";
import VideoTable from "../../components/VideoTable.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../lib/accessPermissions.js";
import { api, formatBytes } from "../../lib/api.js";

// ImageKit free-tier storage limit. Update if you're on a paid plan.
const STORAGE_QUOTA_GB = 20;

export default function Overview() {
  const { admin } = useAuth();
  const canViewVideos = hasPermission(admin, "videos:view");
  const canUpload = hasPermission(admin, "videos:upload");
  const canBulkUpload = admin?.role === "super_admin";

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  // Only gates the very first load — background refreshes (triggered by
  // VideoTable's own status-polling while a video is rendering) update
  // state in place instead of unmounting things, so the page doesn't
  // flash/blink every few seconds while something is processing.
  const [initialLoading, setInitialLoading] = useState(canViewVideos);

  const load = useCallback(async () => {
    if (!canViewVideos) return;
    const [statsRes, videosRes] = await Promise.all([
      api.get("/videos/stats"),
      api.get("/videos", { params: { limit: 5 } }),
    ]);
    setStats(statsRes.data);
    setRecent(videosRes.data.videos);
    setInitialLoading(false);
  }, [canViewVideos]);

  useEffect(() => {
    load();
  }, [load]);

  const storagePct = stats ? Math.min((stats.storageUsed / (STORAGE_QUOTA_GB * 1024 ** 3)) * 100, 100) : 0;
  const storagePctLabel = storagePct > 0 && storagePct < 0.1 ? "<0.1" : storagePct.toFixed(storagePct < 10 ? 1 : 0);

  return (
    <div>
      <Topbar title="Dashboard" subtitle="Overview of your video content and performance." />

      <div className="px-4 py-6 sm:px-8">
        {!canViewVideos ? (
          <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-500">Welcome, {admin?.name}</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              You don't have access to video stats. Use the sidebar to get to what you do have access to.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Videos"
                value={initialLoading ? "—" : stats.totalVideos}
                sub="Uploaded videos"
                icon={Video}
              />
              <StatCard
                label="Total Views"
                value={initialLoading ? "—" : stats.totalViews.toLocaleString()}
                sub="Across all videos"
                icon={Eye}
                iconClass="bg-green-100 text-green-700"
              />
              <StatCard
                label="Total Shares"
                value={initialLoading ? "—" : stats.totalShares.toLocaleString()}
                sub="Links shared"
                icon={Share2}
                iconClass="bg-purple-100 text-purple-700"
              />
              <StatCard
                label="Storage Used"
                value={initialLoading ? "—" : `${formatBytes(stats.storageUsed)} / ${STORAGE_QUOTA_GB} GB`}
                sub={`${storagePctLabel}% used`}
                icon={HardDrive}
                iconClass="bg-amber-100 text-amber-700"
              />
            </div>

            {(canUpload || canBulkUpload) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {canUpload && (
                  <Link to="/dashboard/upload" className="btn-primary">
                    <UploadCloud size={16} />
                    Upload Video
                  </Link>
                )}
                {canBulkUpload && (
                  <Link to="/dashboard/bulk-upload" className="btn-secondary">
                    <Layers size={16} />
                    Bulk Upload
                  </Link>
                )}
              </div>
            )}

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Recent Videos</h2>
              </div>
              {!initialLoading && <VideoTable videos={recent} onChanged={load} compact />}
            </div>

            <div className="mt-4 text-center">
              <Link
                to="/dashboard/videos"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
              >
                View All Videos
                <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
