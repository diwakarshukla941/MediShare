import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UploadCloud, ChevronLeft, ChevronRight, FileSpreadsheet, Download } from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoTable from "../../components/VideoTable.jsx";
import { api } from "../../lib/api.js";
import { createVideosArchive, downloadVideosArchive, downloadVideosSpreadsheet, getDownloadErrorMessage, getVideosArchiveStatus } from "../../lib/downloadVideo.js";
import { useAuth } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";

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
  const [zones, setZones] = useState([]);
  const [downloadZone, setDownloadZone] = useState("all");
  const [archiveJob, setArchiveJob] = useState(() => {
    try { return JSON.parse(localStorage.getItem("medishare_bulk_download_job") || "null"); }
    catch { return null; }
  });
  const [downloadingArchive, setDownloadingArchive] = useState(Boolean(archiveJob));

  useEffect(() => {
    if (admin?.role !== "super_admin") return;
    api.get("/zones").then(({ data }) => setZones(data.zones || [])).catch(() => {});
  }, [admin?.role]);

  useEffect(() => {
    if (admin?.role !== "super_admin" || !archiveJob?.id || !["queued", "processing"].includes(archiveJob.status)) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const job = await getVideosArchiveStatus(archiveJob.id);
        if (cancelled) return;
        setArchiveJob(job);
        localStorage.setItem("medishare_bulk_download_job", JSON.stringify(job));
        if (job.status === "completed") {
          localStorage.removeItem("medishare_bulk_download_job");
          setDownloadingArchive(false);
          setArchiveJob(null);
          downloadVideosArchive(job.downloadUrl);
          toast.success("Your video archive is ready");
          return;
        }
        if (job.status === "failed") {
          localStorage.removeItem("medishare_bulk_download_job");
          setDownloadingArchive(false);
          setArchiveJob(null);
          toast.error(job.error || "Could not prepare the video archive");
          return;
        }
        timer = setTimeout(poll, 4000);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 8000);
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [admin?.role, archiveJob?.id, archiveJob?.status]);

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
    } catch (error) {
      toast.error(await getDownloadErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const downloadArchive = async () => {
    setDownloadingArchive(true);
    try {
      const job = await createVideosArchive(downloadZone);
      localStorage.setItem("medishare_bulk_download_job", JSON.stringify(job));
      setArchiveJob(job);
    } catch (error) {
      toast.error(await getDownloadErrorMessage(error));
      setDownloadingArchive(false);
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
            {admin?.role === "super_admin" && (
              <>
                <label className="sr-only" htmlFor="bulk-download-zone">Zone for bulk download</label>
                <select id="bulk-download-zone" className="input !w-auto" value={downloadZone} onChange={(e) => setDownloadZone(e.target.value)} disabled={downloadingArchive}>
                  <option value="all">All zones</option>
                  {zones.map((zone) => <option key={zone._id} value={zone.name}>{zone.name}</option>)}
                </select>
                <button type="button" onClick={downloadArchive} className="btn-secondary" disabled={downloadingArchive}>
                  <Download size={16} />
                  {downloadingArchive ? `Preparing ZIP (${archiveJob?.processedVideos || 0}/${archiveJob?.totalVideos || "…"})` : "Download videos"}
                </button>
              </>
            )}
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
