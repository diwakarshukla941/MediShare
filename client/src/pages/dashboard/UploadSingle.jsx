import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoDropzone from "../../components/VideoDropzone.jsx";
import ZoneField from "../../components/ZoneField.jsx";
import { getErrorMessage } from "../../lib/api.js";
import { uploadVideoDirect } from "../../lib/directVideoUpload.js";

const initialForm = {
  doctorName: "",
  credentials: "",
  empId: "",
  zone: "",
  phone: "",
};

export default function UploadSingle() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState("");

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a video to upload");
      return;
    }

    setUploading(true);
    setProgress(0);
    setPhase("Uploading your video to secure storage...");
    try {
      await uploadVideoDirect(file, form, (loaded, total) => setProgress(Math.round((loaded * 100) / total)), {
        waitForRender: true,
        onStatus: setPhase,
      });
      toast.success("Video uploaded and framed successfully");
      navigate("/dashboard/videos");
    } catch (err) {
      toast.error(err.code === "VIDEO_RENDER_FAILED"
        ? `The upload is safe, but the frame could not be prepared: ${err.message}`
        : getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Topbar title="Upload Video (Single)" subtitle="Add a new video with doctor details." />

      <div className="px-4 py-6 sm:px-8">
        <form onSubmit={submit} className="card max-w-2xl space-y-5 p-6">
          <VideoDropzone file={file} onChange={setFile} maxSizeMB={500} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Doctor Name</label>
              <input
                className="input"
                required
                placeholder="Diwakar Shukla"
                value={form.doctorName}
                onChange={update("doctorName")}
              />
            </div>
            <div>
              <label className="label">Credentials</label>
              <input className="input" required placeholder="MBBS" value={form.credentials} onChange={update("credentials")} />
            </div>
            <div>
              <label className="label">Employee ID</label>
              <input
                className="input"
                required
                placeholder="EMP-001"
                value={form.empId}
                onChange={update("empId")}
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                className="input"
                type="tel"
                required
                placeholder="+91 12345 67890"
                value={form.phone}
                onChange={update("phone")}
              />
            </div>
            <ZoneField value={form.zone} onChange={update("zone")} />
          </div>

          {uploading && (
            <div>
              {progress < 100 ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-brand-700"><Loader2 size={16} className="animate-spin" /><div className="h-2 flex-1 animate-pulse rounded-full bg-brand-100" /></div>
              )}
              <p className="mt-1.5 text-xs text-slate-500">{phase || `Uploading... ${progress}%`}</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={uploading}>
            {uploading ? (progress >= 100 ? "Preparing framed video..." : "Uploading...") : "Upload Video"}
          </button>
        </form>
      </div>
    </div>
  );
}
