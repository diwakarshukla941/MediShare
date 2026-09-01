import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UploadCloud, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoTable from "../../components/VideoTable.jsx";
import { api } from "../../lib/api.js";

export default function MyVideos() {
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      const { data } = await api.get("/videos", { params: { page, limit: 10, search } });
      setVideos(data.videos);
      setPagination(data.pagination);
      setLoading(false);
    },
    [search]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <Topbar title="My Videos" subtitle={`${pagination.total} video${pagination.total === 1 ? "" : "s"} in your library`} />

      <div className="px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Link to="/dashboard/upload" className="btn-primary">
              <UploadCloud size={16} />
              Upload Video
            </Link>
            <Link to="/dashboard/bulk-upload" className="btn-secondary">
              <Layers size={16} />
              Bulk Upload
            </Link>
          </div>
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {!loading && <VideoTable videos={videos} onChanged={() => load(pagination.page)} />}

        {pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              className="btn-secondary !px-3"
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              className="btn-secondary !px-3"
              disabled={pagination.page >= pagination.pages}
              onClick={() => load(pagination.page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
