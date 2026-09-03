import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoDropzone from "../../components/VideoDropzone.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

const initialForm = {
  doctorName: "",
  degree: "",
  specialization: "",
  organizationName: "",
  phone: "",
  email: "",
};

export default function UploadSingle() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a video to upload");
      return;
    }

    const data = new FormData();
    data.append("video", file);
    Object.entries(form).forEach(([k, v]) => data.append(k, v));

    setUploading(true);
    setProgress(0);
    try {
      await api.post("/videos", data, {
        onUploadProgress: (evt) => setProgress(Math.round((evt.loaded * 100) / evt.total)),
      });
      toast.success("Video uploaded successfully");
      navigate("/dashboard/videos");
    } catch (err) {
      toast.error(getErrorMessage(err));
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
                placeholder="Dr. Diwakar Shukla"
                value={form.doctorName}
                onChange={update("doctorName")}
              />
            </div>
            <div>
              <label className="label">Degree</label>
              <input className="input" required placeholder="MBBS" value={form.degree} onChange={update("degree")} />
            </div>
            <div>
              <label className="label">Specialization</label>
              <input
                className="input"
                placeholder="General Physician"
                value={form.specialization}
                onChange={update("specialization")}
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
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                placeholder="doctor@clinic.com"
                value={form.email}
                onChange={update("email")}
              />
            </div>
            <div>
              <label className="label">Organization Name</label>
              <input
                className="input"
                placeholder="MediCare Clinic"
                value={form.organizationName}
                onChange={update("organizationName")}
              />
            </div>
          </div>

          {uploading && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Uploading... {progress}%</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        </form>
      </div>
    </div>
  );
}
