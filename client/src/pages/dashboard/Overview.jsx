import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Video, Eye, Share2, HardDrive, UploadCloud, Layers, ArrowRight } from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import StatCard from "../../components/StatCard.jsx";
import VideoTable from "../../components/VideoTable.jsx";
import { api, formatBytes } from "../../lib/api.js";

// ImageKit free-tier storage limit. Update if you're on a paid plan.
const STORAGE_QUOTA_GB = 20;

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, videosRes] = await Promise.all([
      api.get("/videos/stats"),
      api.get("/videos", { params: { limit: 5 } }),
    ]);
    setStats(statsRes.data);
    setRecent(videosRes.data.videos);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storagePct = stats ? Math.min((stats.storageUsed / (STORAGE_QUOTA_GB * 1024 ** 3)) * 100, 100) : 0;
  const storagePctLabel = storagePct > 0 && storagePct < 0.1 ? "<0.1" : storagePct.toFixed(storagePct < 10 ? 1 : 0);

  return (
    <div>
      <Topbar title="Dashboard" subtitle="Overview of your video content and performance." />

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Videos"
            value={loading ? "—" : stats.totalVideos}
            sub="Uploaded videos"
            icon={Video}
          />
          <StatCard
            label="Total Views"
            value={loading ? "—" : stats.totalViews.toLocaleString()}
            sub="Across all videos"
            icon={Eye}
            iconClass="bg-green-100 text-green-700"
          />
          <StatCard
            label="Total Shares"
            value={loading ? "—" : stats.totalShares.toLocaleString()}
            sub="Links shared"
            icon={Share2}
            iconClass="bg-purple-100 text-purple-700"
          />
          <StatCard
            label="Storage Used"
            value={loading ? "—" : `${formatBytes(stats.storageUsed)} / ${STORAGE_QUOTA_GB} GB`}
            sub={`${storagePctLabel}% used`}
            icon={HardDrive}
            iconClass="bg-amber-100 text-amber-700"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dashboard/upload" className="btn-primary">
            <UploadCloud size={16} />
            Upload Video
          </Link>
          <Link to="/dashboard/bulk-upload" className="btn-secondary">
            <Layers size={16} />
            Bulk Upload
          </Link>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Videos</h2>
          </div>
          {!loading && <VideoTable videos={recent} onChanged={load} compact />}
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
      </div>
    </div>
  );
}
