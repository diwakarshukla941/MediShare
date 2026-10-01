import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FolderOpen, AlertCircle, CheckCircle2, Video } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, getErrorMessage } from "../../lib/api.js";
import { parseSheetFile, isVideoFile } from "../../lib/parseSheet.js";
import { uploadVideoDirect } from "../../lib/directVideoUpload.js";

export default function BulkUpload() {
  const [folderFiles, setFolderFiles] = useState([]);
  const [sheetFile, setSheetFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!sheetFile || folderFiles.length === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setParsing(true);
    parseSheetFile(sheetFile)
      .then((rows) => {
        if (cancelled) return;
        const filesByName = new Map(folderFiles.map((f) => [f.name.trim().toLowerCase(), f]));
        const matched = [];
        const unmatchedRows = [];
        for (const row of rows) {
          const key = String(row.filename || "").trim().toLowerCase();
          const file = key && filesByName.get(key);
          if (file) matched.push({ row, file });
          else unmatchedRows.push(row);
        }
        const matchedNames = new Set(matched.map((m) => m.file.name.trim().toLowerCase()));
        const unmatchedFiles = folderFiles.filter((f) => !matchedNames.has(f.name.trim().toLowerCase()));
        setPreview({ matched, unmatchedRows, unmatchedFiles, totalRows: rows.length });
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not read that file — please check it's a valid CSV or Excel file.");
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sheetFile, folderFiles]);

  const downloadSample = async () => {
    const { data } = await api.get("/videos/sample-csv", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bonconnect-bulk-upload-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFolderChange = (e) => {
    const files = Array.from(e.target.files || []).filter(isVideoFile);
    setFolderFiles(files);
    setResult(null);
    if (files.length === 0) toast.error("No video files (MP4, MOV, AVI, WEBM) found in that folder");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!preview || preview.matched.length === 0) {
      toast.error("No video files matched a row in your CSV/Excel file yet");
      return;
    }

    setUploading(true);
    setProgress(0);
    setResult(null);
    try {
      const created = [];
      const errors = [];
      const totalBytes = preview.matched.reduce((sum, item) => sum + item.file.size, 0);
      let completedBytes = 0;
      for (const { row, file } of preview.matched) {
        try {
          const response = await uploadVideoDirect(file, {
            doctorName: row.doctorname,
            credentials: row.credentials,
            empId: row.empid,
            zone: row.zone,
            phone: row.phone,
          }, (loaded) => {
            setProgress(Math.round(((completedBytes + loaded) * 100) / totalBytes));
          });
          created.push(response.video);
        } catch (error) {
          errors.push({ fileName: file.name, error: error.response?.data?.message || error.message || "Upload failed" });
        }
        completedBytes += file.size;
        setProgress(Math.round((completedBytes * 100) / totalBytes));
      }
      const res = { created, errors, createdCount: created.length, errorCount: errors.length };
      setResult(res);
      if (res.createdCount > 0) toast.success(`${res.createdCount} video(s) uploaded successfully`);
      if (res.errorCount > 0) toast.error(`${res.errorCount} row(s) failed`);
      if (res.createdCount > 0 && res.errorCount === 0) {
        setFolderFiles([]);
        setSheetFile(null);
        setPreview(null);
      } else if (res.createdCount > 0) {
        const failedNames = new Set(res.errors.map((item) => item.fileName.trim().toLowerCase()));
        setFolderFiles((current) => current.filter((file) => failedNames.has(file.name.trim().toLowerCase())));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Topbar
        title="Bulk Upload"
        subtitle="Pick a folder of videos and a CSV/Excel sheet — matched by file name."
      />

      <div className="px-4 py-6 sm:px-8">
        <form onSubmit={submit} className="card max-w-2xl space-y-6 p-6">
          <div>
            <label className="label">1. Select Videos Folder</label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Pick the folder containing all your video files. We'll automatically match each one to a row in
                your sheet by file name — no need to select files one by one.
              </p>
              <div className="mt-3">
                <label className="btn-secondary inline-flex cursor-pointer">
                  <FolderOpen size={15} />
                  {folderFiles.length > 0 ? `${folderFiles.length} video(s) found` : "Select Folder"}
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={onFolderChange}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="label">2. Upload via CSV or Excel</label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Add video details in a CSV or Excel file. The <code className="rounded bg-slate-200 px-1">fileName</code>{" "}
                column must exactly match each video's file name in the folder above.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadSample} className="btn-secondary">
                  <Download size={15} />
                  Download Sample CSV
                </button>
                <label className="btn-secondary cursor-pointer">
                  <FileSpreadsheet size={15} />
                  {sheetFile ? sheetFile.name : "Choose CSV/Excel File"}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => setSheetFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          </div>

          {parsing && <p className="text-xs text-slate-400">Matching videos to your sheet...</p>}

          {preview && !parsing && (
            <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <Video size={15} className="text-brand-600" />
                {preview.matched.length} of {preview.totalRows} row(s) matched to a video file
              </div>
              {preview.unmatchedRows.length > 0 && (
                <p className="text-xs text-amber-600">
                  {preview.unmatchedRows.length} row(s) have no matching video in the folder:{" "}
                  {preview.unmatchedRows.map((r) => r.filename || "(blank fileName)").join(", ")}
                </p>
              )}
              {preview.unmatchedFiles.length > 0 && (
                <p className="text-xs text-slate-400">
                  {preview.unmatchedFiles.length} video(s) in the folder have no matching row and will be skipped:{" "}
                  {preview.unmatchedFiles.map((f) => f.name).join(", ")}
                </p>
              )}
            </div>
          )}

          {uploading && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Uploading {preview?.matched.length || 0} video(s)... {progress}%
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={uploading || !preview || preview.matched.length === 0}
          >
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
