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
  designation: "",
  organizationName: "",
  title: "",
  description: "",
  phone: "",
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

      <div className="px-8 py-6">
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
              <label className="label">Phone (for appointments)</label>
              <input className="input" placeholder="+91 12345 67890" value={form.phone} onChange={update("phone")} />
            </div>
            <div>
              <label className="label">Designation</label>
              <input
                className="input"
                placeholder="Senior Consultant"
                value={form.designation}
                onChange={update("designation")}
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
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="Health Tips for Good Sleep"
              value={form.title}
              onChange={update("title")}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Short description shown to patients"
              value={form.description}
              onChange={update("description")}
            />
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
