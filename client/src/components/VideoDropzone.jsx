import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileVideo, X } from "lucide-react";

const ACCEPTED = ".mp4,.mov,.avi,.webm,video/mp4,video/quicktime,video/x-msvideo,video/webm";

export default function VideoDropzone({ file, onChange, multiple = false, maxSizeMB = 500 }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList).filter((f) => f.size <= maxSizeMB * 1024 * 1024);
      if (files.length === 0) return;
      onChange(multiple ? files : files[0]);
    },
    [onChange, multiple, maxSizeMB]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const files = multiple ? file || [] : file ? [file] : [];

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
          <UploadCloud size={22} />
        </span>
        <p className="mt-3 text-sm text-slate-600">
          Drag &amp; drop your video{multiple ? "s" : ""} here or
        </p>
        <span className="btn-primary mt-3">Choose File{multiple ? "s" : ""}</span>
        <p className="mt-3 text-xs text-slate-400">
          Supports: MP4, MOV, AVI, WEBM (Max {maxSizeMB >= 1024 ? `${maxSizeMB / 1024}GB` : `${maxSizeMB}MB`}
          {multiple ? " per file, up to 20 files" : ""})
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileVideo size={16} className="shrink-0 text-brand-600" />
                <span className="truncate text-sm text-slate-700">{f.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{(f.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (multiple) {
                    onChange(files.filter((_, idx) => idx !== i));
                  } else {
                    onChange(null);
                  }
                }}
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
