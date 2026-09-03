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
  // Only gates the very first load — background refreshes (pagination,
  // search, and VideoTable's own status-polling while a video is rendering)
  // update `videos` in place instead of unmounting the table, so the list
  // doesn't flash/blink every few seconds while something is processing.
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    async (page = 1) => {
      const { data } = await api.get("/videos", { params: { page, limit: 10, search } });
      setVideos(data.videos);
      setPagination(data.pagination);
      setInitialLoading(false);
    },
    [search]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleChanged = useCallback(() => load(pagination.page), [load, pagination.page]);

  return (
    <div>
      <Topbar title="My Videos" subtitle={`${pagination.total} video${pagination.total === 1 ? "" : "s"} in your library`} />

      <div className="px-4 py-6 sm:px-8">
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
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by doctor, title, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {!initialLoading && <VideoTable videos={videos} onChanged={handleChanged} />}

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
