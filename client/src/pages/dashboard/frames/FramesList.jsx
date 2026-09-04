import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Copy, Trash2, CheckCircle2, Eye, FileText, Flame, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../../components/dashboard/Topbar.jsx";
import FrameRenderer from "../../../components/FrameRenderer.jsx";
import ConfirmDialog from "../../../components/ConfirmDialog.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { api, getErrorMessage } from "../../../lib/api.js";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";

const SAMPLE_VIDEO = {
  doctorName: "Dr. Diwakar Shukla",
  degree: "MBBS",
  specialization: "General Physician",
  title: "Health Tips for Good Sleep",
  description: "Simple tips for better sleep",
  organizationName: "MediCare Clinic",
};

export default function FramesList() {
  const { admin } = useAuth();
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/frames");
    setFrames(data.frames);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async (frame) => {
    const toastId = toast.loading(`Activating "${frame.name}"...`);
    try {
      const { data } = await api.post(`/frames/${frame._id}/activate`);
      toast.success("Active — videos will render with this frame the next time they're downloaded", { id: toastId });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    }
  };

  const duplicate = async (frame) => {
    try {
      await api.post(`/frames/${frame._id}/duplicate`);
      toast.success("Frame duplicated");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/frames/${deleting._id}`, { params: { confirm: "true" } });
      toast.success("Frame deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Topbar title="Frames" subtitle="Design and manage the branded frame applied to your videos." />

      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex justify-end gap-2">
          <Link to={`${FRAME_STUDIO_BASE}/content-templates`} className="btn-secondary">
            <FileText size={16} />
            Content Templates
          </Link>
          <Link to={`${FRAME_STUDIO_BASE}/new`} className="btn-primary">
            <Plus size={16} />
            Create New Frame
          </Link>
        </div>

        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        ) : frames.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
            <p className="text-sm font-medium text-slate-500">No frames yet</p>
            <p className="mt-1 text-xs text-slate-400">Create your first frame to start branding your videos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {frames.map((frame) => (
              <div key={frame._id} className="card overflow-hidden">
                <div className="relative bg-slate-100 p-4">
                  {frame.isActive && (
                    <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  )}
                  <div className="mx-auto max-w-[220px]">
                    <FrameRenderer frame={frame} video={SAMPLE_VIDEO}>
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] text-slate-400">
                        Video
                      </div>
                    </FrameRenderer>
                  </div>
                </div>

                <div className="p-4">
                  <p className="truncate text-sm font-semibold text-slate-900">{frame.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {frame.aspectRatio} · Used in {frame.usageCount} video{frame.usageCount === 1 ? "" : "s"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Link to={`${FRAME_STUDIO_BASE}/${frame._id}`} className="btn-secondary !py-1.5 text-xs">
                      <Pencil size={12} />
                      Edit
                    </Link>
                    <button onClick={() => duplicate(frame)} className="btn-secondary !py-1.5 text-xs">
                      <Copy size={12} />
                      Duplicate
                    </button>
                    {!frame.isActive && (
                      <button onClick={() => activate(frame)} className="btn-secondary !py-1.5 text-xs">
                        <Eye size={12} />
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => setDeleting(frame)}
                      className="ml-auto rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {admin?.role === "super_admin" && !loading && frames.length > 0 && (
          <BurnExistingVideosPanel frames={frames} />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this frame?"
        message={
          deleting?.usageCount > 0
            ? `"${deleting?.name}" has been used to render ${deleting?.usageCount} video(s). Deleting it won't remove those videos, but it can no longer be edited or re-activated.`
            : `"${deleting?.name}" will be permanently deleted.`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={busy}
      />
    </div>
  );
}

function formatBytes(n) {
  if (!n) return "0 KB";
  const kb = n / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

// Super-admin-only, hidden: burns a chosen frame into videos that still have
// a clean (unbaked) source — a one-way conversion, see frame.controller.js.
function BurnExistingVideosPanel({ frames }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [frameId, setFrameId] = useState(frames.find((f) => f.isActive)?._id || frames[0]?._id || "");
  const [burning, setBurning] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/frames/videos/unbaked");
    setVideos(data.videos);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = videos.length > 0 && selected.size === videos.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(videos.map((v) => v._id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const burn = async () => {
    if (!frameId || selected.size === 0) return;
    setBurning(true);
    setResult(null);
    const toastId = toast.loading(`Burning frame into ${selected.size} video(s)... this can take a while`);
    try {
      const { data } = await api.post(`/frames/${frameId}/burn-existing`, { videoIds: [...selected] });
      setResult(data);
      toast.success(`${data.burnedCount} video(s) updated${data.errorCount ? `, ${data.errorCount} failed` : ""}`, {
        id: toastId,
      });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setBurning(false);
    }
  };

  return (
    <div className="card mt-8 max-w-3xl p-5">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-amber-500" />
        <p className="text-sm font-semibold text-slate-900">Re-burn Existing Videos</p>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
          Super Admin
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Pick any frame and burn it into videos below that still have a clean, unframed source (older uploads, or
        anything uploaded while no frame was active). This replaces each video's file in place — old file deleted,
        one file per video, no extra storage. It's permanent: once burned this way, a video is locked to that frame
        the same as a new upload would be.
      </p>

      {loading ? (
        <div className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      ) : videos.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">
          No eligible videos — everything already has a frame burned in, or has never been uploaded.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select className="input !w-auto" value={frameId} onChange={(e) => setFrameId(e.target.value)}>
              {frames.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name} {f.isActive ? "(active)" : ""}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              disabled={burning || !frameId || selected.size === 0}
              onClick={burn}
            >
              <Flame size={15} />
              {burning ? "Burning..." : `Burn ${selected.size || ""} Selected`}
            </button>
            <button type="button" className="btn-secondary" onClick={toggleAll}>
              <CheckCheck size={15} />
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            {videos.map((v) => (
              <label
                key={v._id}
                className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
              >
                <input type="checkbox" checked={selected.has(v._id)} onChange={() => toggleOne(v._id)} />
                <span className="flex-1 truncate">
                  <span className="font-medium text-slate-800">{v.doctorName}</span>{" "}
                  <span className="text-slate-400">· {v.email}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(v.fileSize)}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          {result.burned.length > 0 && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-800">
              <p className="font-semibold">{result.burned.length} video(s) burned successfully</p>
              <ul className="mt-1 space-y-0.5">
                {result.burned.map((b) => (
                  <li key={b.id}>{b.doctorName}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold">{result.errors.length} video(s) failed</p>
              <ul className="mt-1 space-y-0.5">
                {result.errors.map((e) => (
                  <li key={e.id}>
                    {e.doctorName}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
