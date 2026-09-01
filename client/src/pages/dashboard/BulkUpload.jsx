import { useState } from "react";
import { Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import VideoDropzone from "../../components/VideoDropzone.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

export default function BulkUpload() {
  const [files, setFiles] = useState([]);
  const [csv, setCsv] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const downloadSample = async () => {
    const { data } = await api.get("/videos/sample-csv", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medishare-bulk-upload-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Add at least one video file");
      return;
    }
    if (!csv) {
      toast.error("Upload a CSV with video details (filename must match your video files)");
      return;
    }

    const data = new FormData();
    files.forEach((f) => data.append("videos", f));
    data.append("csv", csv);

    setUploading(true);
    setProgress(0);
    setResult(null);
    try {
      const { data: res } = await api.post("/videos/bulk", data, {
        onUploadProgress: (evt) => setProgress(Math.round((evt.loaded * 100) / evt.total)),
      });
      setResult(res);
      if (res.createdCount > 0) toast.success(`${res.createdCount} video(s) uploaded successfully`);
      if (res.errorCount > 0) toast.error(`${res.errorCount} row(s) failed`);
      if (res.createdCount > 0) {
        setFiles([]);
        setCsv(null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Topbar title="Bulk Upload" subtitle="Upload multiple videos at once using a CSV template." />

      <div className="px-8 py-6">
        <form onSubmit={submit} className="card max-w-2xl space-y-6 p-6">
          <div>
            <label className="label">Upload Multiple Videos</label>
            <VideoDropzone file={files} onChange={setFiles} multiple maxSizeMB={500} />
          </div>

          <div>
            <label className="label">Upload via CSV</label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Add video details in a CSV file. The <code className="rounded bg-slate-200 px-1">fileName</code>{" "}
                column must exactly match each uploaded video's file name.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadSample} className="btn-secondary">
                  <Download size={15} />
                  Download Sample CSV
                </button>
                <label className="btn-secondary cursor-pointer">
                  <FileSpreadsheet size={15} />
                  {csv ? csv.name : "Choose CSV File"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => setCsv(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          </div>

          {uploading && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Uploading {files.length} video(s)... {progress}%</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={uploading}>
            {uploading ? "Processing..." : "Upload & Process"}
          </button>
        </form>

        {result && (
          <div className="mt-6 max-w-2xl space-y-3">
            {result.created.length > 0 && (
              <div className="card flex items-start gap-3 border-green-100 bg-green-50 p-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">{result.created.length} video(s) uploaded</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-green-700">
                    {result.created.map((v) => (
                      <li key={v._id}>{v.title || v.fileName} — {v.doctorName}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="card flex items-start gap-3 border-red-100 bg-red-50 p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-800">{result.errors.length} row(s) failed</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        {e.fileName}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
