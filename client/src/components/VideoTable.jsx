import { useEffect, useState } from "react";
import { Copy, Share2, Pencil, Trash2, Eye, Download, Loader2, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../lib/api.js";
import { downloadFramedVideo, getDownloadErrorMessage } from "../lib/downloadVideo.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import EditVideoModal from "./EditVideoModal.jsx";

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VideoTable({ videos, onChanged, compact = false, selectable = false }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const isProcessing = (video) => video.renderingStatus === "processing";

  useEffect(() => {
    if (!videos.some(isProcessing)) return undefined;
    const interval = setInterval(onChanged, 5000);
    return () => clearInterval(interval);
  }, [videos, onChanged]);

  useEffect(() => setSelectedIds((current) => new Set([...current].filter((id) => videos.some((video) => video._id === id)))), [videos]);

  const downloadFramed = async (video) => {
    setDownloadingId(video._id);
    const toastId = toast.loading("Preparing download...");
    try {
      await downloadFramedVideo(video._id, `${video.doctorName || "video"}.mp4`);
      toast.success("Download ready", { id: toastId });
    } catch (err) {
      toast.error(await getDownloadErrorMessage(err), { id: toastId });
    } finally {
      setDownloadingId(null);
    }
  };

  const watchUrl = (slug) => `${window.location.origin}/watch/${slug}`;

  const copyLink = async (video) => {
    try {
      await navigator.clipboard.writeText(watchUrl(video.slug));
    } catch {
      // ignore — toast still confirms intent, user can copy manually if clipboard blocked
    }
    toast.success("Link copied");
    api.post(`/videos/${video._id}/share`).catch(() => {});
  };

  const shareLink = async (video) => {
    const url = watchUrl(video.slug);
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title || video.doctorName, url });
        api.post(`/videos/${video._id}/share`).catch(() => {});
        return;
      } catch {
        return;
      }
    }
    copyLink(video);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/videos/${deleting._id}`);
      toast.success("Video deleted");
      setDeleting(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds((current) => current.size === videos.length ? new Set() : new Set(videos.map((video) => video._id)));
  const confirmSelectedDelete = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete("/videos/bulk", { data: { ids: [...selectedIds] } });
      toast.success(data.message); setSelectedIds(new Set()); setDeletingSelected(false); onChanged();
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  if (videos.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-500">No videos yet</p>
        <p className="mt-1 text-xs text-slate-400">Upload a video to see it listed here.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {selectable && selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3">
          <span className="text-sm font-medium text-red-800">{selectedIds.size} video{selectedIds.size === 1 ? "" : "s"} selected</span>
          <button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700" onClick={() => setDeletingSelected(true)}><Trash2 size={15} />Delete selected</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {selectable && <th className="w-10 px-4 py-3"><input aria-label="Select all videos on this page" type="checkbox" checked={videos.length > 0 && selectedIds.size === videos.length} onChange={toggleAll} /></th>}
              <th className="px-5 py-3 font-medium">Doctor &amp; Contact</th>
              <th className="px-5 py-3 font-medium">Views</th>
              {!compact && <th className="px-5 py-3 font-medium">Shares</th>}
              {!compact && <th className="px-5 py-3 font-medium">Uploaded By</th>}
              <th className="px-5 py-3 font-medium">Uploaded On</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {videos.map((video) => (
              <tr key={video._id} className="transition hover:bg-slate-50/60">
                {selectable && <td className="px-4 py-3.5"><input aria-label={`Select ${video.doctorName}`} type="checkbox" checked={selectedIds.has(video._id)} onChange={() => toggleSelected(video._id)} /></td>}
                <td className="max-w-xs px-5 py-3.5">
                  <p className="truncate font-semibold text-slate-900">{video.doctorName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {video.credentials}
                    {video.empId ? ` · ${video.empId}` : ""}
                    {video.zone ? ` · ${video.zone}` : ""}
                  </p>
                  {isProcessing(video) && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Processing frame…</span>}
                  {video.renderingStatus === "failed" && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Processing failed</span>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" />
                      {video.phone}
                    </span>
                  </p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Eye size={14} className="text-slate-400" />
                    {video.views}
                  </span>
                </td>
                {!compact && <td className="px-5 py-3.5 text-slate-600">{video.shareCount}</td>}
                {!compact && (
                  <td className="max-w-[10rem] px-5 py-3.5">
                    {video.uploadedByName ? (
                      <>
                        <p className="truncate text-xs font-medium text-slate-700">{video.uploadedByName}</p>
                        {video.uploadedByLocation && (
                          <p className="truncate text-xs text-slate-400">{video.uploadedByLocation}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {video.source === "public" ? "Public link" : "—"}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-5 py-3.5 text-slate-500">{formatDate(video.createdAt)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={watchUrl(video.slug)}
                      target="_blank"
                      rel="noreferrer"
                      title="Watch"
                      className={`rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${isProcessing(video) ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <Eye size={16} />
                    </a>
                    <button
                      title="Copy link"
                      onClick={() => copyLink(video)}
                      disabled={isProcessing(video)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      title="Share"
                      onClick={() => shareLink(video)}
                      disabled={isProcessing(video)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      title={downloadingId === video._id ? "Preparing download..." : "Download"}
                      onClick={() => downloadFramed(video)}
                      disabled={downloadingId === video._id || isProcessing(video)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      {downloadingId === video._id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                    </button>
                    <button
                      title="Edit info"
                      onClick={() => setEditing(video)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => setDeleting(video)}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditVideoModal
          video={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this video?"
        message={`"${deleting?.doctorName}" will be permanently removed and its link will stop working.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={busy}
      />
      <ConfirmDialog
        open={deletingSelected}
        title={`Delete ${selectedIds.size} selected video${selectedIds.size === 1 ? "" : "s"}?`}
        message="This permanently removes the selected videos, their uploaded files, and their analytics. Their public links will stop working."
        onConfirm={confirmSelectedDelete}
        onCancel={() => setDeletingSelected(false)}
        loading={busy}
      />
    </div>
  );
}
