import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Copy, Trash2, CheckCircle2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../../components/dashboard/Topbar.jsx";
import FrameRenderer from "../../../components/FrameRenderer.jsx";
import ConfirmDialog from "../../../components/ConfirmDialog.jsx";
import { api, getErrorMessage } from "../../../lib/api.js";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";

const SAMPLE_VIDEO = {
  doctorName: "Dr. Diwakar Shukla",
  degree: "MBBS",
  specialization: "General Physician",
  designation: "Senior Consultant",
  title: "Health Tips for Good Sleep",
  description: "Simple tips for better sleep",
  organizationName: "MediCare Clinic",
};

export default function FramesList() {
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
      toast.success(`Active — re-rendering ${data.queuedCount} video(s) in the background`, { id: toastId });
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

      <div className="px-8 py-6">
        <div className="mb-5 flex justify-end">
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
