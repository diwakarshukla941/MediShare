import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UploadCloud, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoTable from "../../components/VideoTable.jsx";
import { api } from "../../lib/api.js";
import { downloadVideosSpreadsheet } from "../../lib/downloadVideo.js";
import { useAuth } from "../../context/AuthContext.jsx";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export default function MyVideos() {
  const { admin } = useAuth();
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [ownership, setOwnership] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  // Only gates the very first load — background refreshes (pagination,
  // search, and VideoTable's own status-polling while a video is rendering)
  // update `videos` in place instead of unmounting the table, so the list
  // doesn't flash/blink every few seconds while something is processing.
  const [initialLoading, setInitialLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      const { data } = await api.get("/videos", {
        params: { page, limit: pageSize, search, ownership },
      });
      setVideos(data.videos);
      setPagination(data.pagination);
      setInitialLoading(false);
    },
    [search, pageSize, ownership]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleChanged = useCallback(() => load(pagination.page), [load, pagination.page]);

  const exportSpreadsheet = async () => {
    setExporting(true);
    try {
      await downloadVideosSpreadsheet();
    } finally {
      setExporting(false);
    }
  };

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
            <button type="button" onClick={exportSpreadsheet} className="btn-secondary" disabled={exporting}>
              <FileSpreadsheet size={16} />
              {exporting ? "Preparing..." : "Download Excel"}
            </button>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="sr-only" htmlFor="video-ownership-filter">
              Filter videos by uploader
            </label>
            <select
              id="video-ownership-filter"
              className="input !w-full sm:!w-auto"
              value={ownership}
              onChange={(e) => setOwnership(e.target.value)}
            >
              <option value="all">All videos</option>
              <option value="mine">Uploaded by me</option>
            </select>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!initialLoading && <VideoTable videos={videos} onChanged={handleChanged} selectable={admin?.role === "super_admin"} />}

        {!initialLoading && pagination.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Rows per page
              <select
                className="input !w-auto !py-1.5 pr-8"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            {pagination.pages > 1 && (
              <div className="flex items-center gap-3">
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
        )}
      </div>
    </div>
  );
}
