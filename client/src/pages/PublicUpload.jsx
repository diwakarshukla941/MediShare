import { useState } from "react";
import { Link } from "react-router-dom";
import { UploadCloud, Link2, Share2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../components/Logo.jsx";
import VideoDropzone from "../components/VideoDropzone.jsx";
import CopyLinkField from "../components/CopyLinkField.jsx";
import { api, getErrorMessage } from "../lib/api.js";

const initialForm = { doctorName: "", degree: "", specialization: "", title: "" };

export default function PublicUpload() {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

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
      const { data: res } = await api.post("/videos", data, {
        onUploadProgress: (evt) => setProgress(Math.round((evt.loaded * 100) / evt.total)),
      });
      setResult({ url: `${window.location.origin}${res.watchPath}` });
      toast.success("Video uploaded successfully");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={28} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Video Uploaded!</h1>
          <p className="mt-1.5 text-sm text-slate-500">Share this link with your patients so they can watch it.</p>

          <div className="mt-6">
            <CopyLinkField url={result.url} />
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <a href={result.url} target="_blank" rel="noreferrer" className="btn-secondary">
              Preview Video
            </a>
            <button
              className="btn-primary"
              onClick={() => {
                setResult(null);
                setFile(null);
                setForm(initialForm);
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:px-10">
        <Logo />
        <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Dashboard Login
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UploadCloud size={22} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Upload Your Video</h1>
          <p className="mt-1.5 text-sm text-slate-500">Share educational videos with patients easily.</p>
        </div>

        <form onSubmit={submit} className="card mt-8 space-y-5 p-6">
          <VideoDropzone file={file} onChange={setFile} maxSizeMB={500} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Doctor Name</label>
              <input
                className="input"
                required
                placeholder="e.g. Dr. Diwakar Shukla"
                value={form.doctorName}
                onChange={update("doctorName")}
              />
            </div>
            <div>
              <label className="label">Degree</label>
              <input
                className="input"
                required
                placeholder="e.g. MBBS, BHMS"
                value={form.degree}
                onChange={update("degree")}
              />
            </div>
            <div>
              <label className="label">Specialization (Optional)</label>
              <input
                className="input"
                placeholder="e.g. General Physician"
                value={form.specialization}
                onChange={update("specialization")}
              />
            </div>
            <div>
              <label className="label">Title (Optional)</label>
              <input
                className="input"
                placeholder="e.g. Diabetes Care Tips"
                value={form.title}
                onChange={update("title")}
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

        <div className="card mt-6 p-6">
          <h2 className="text-sm font-semibold text-slate-900">How it works?</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Step icon={UploadCloud} title="1. Upload" desc="Upload your video with details." />
            <Step icon={Link2} title="2. Get Link" desc="We generate a secure link for your video." />
            <Step icon={Share2} title="3. Share" desc="Share the link with your patients anywhere." />
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Your video will be available to anyone with the link.
          </p>
        </div>
      </main>
    </div>
  );
}

function Step({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon size={18} />
      </span>
      <p className="mt-2 text-xs font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
    </div>
  );
}
