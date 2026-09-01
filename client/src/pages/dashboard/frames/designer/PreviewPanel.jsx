import { useEffect, useState } from "react";
import { api } from "../../../../lib/api.js";
import FrameRenderer from "../../../../components/FrameRenderer.jsx";

export default function PreviewPanel({ frame }) {
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/videos", { params: { limit: 50 } })
      .then(({ data }) => {
        setVideos(data.videos);
        if (data.videos[0]) setSelectedId(data.videos[0]._id);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedVideo = videos.find((v) => v._id === selectedId);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview Video</h3>

      {!loading && videos.length > 0 && (
        <select
          className="input mt-2 !py-1.5 text-xs"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {videos.map((v) => (
            <option key={v._id} value={v._id}>
              {v.doctorName} — {v.title || "Untitled"}
            </option>
          ))}
        </select>
      )}

      <div className="mt-4">
        {selectedVideo ? (
          <FrameRenderer frame={frame} video={selectedVideo}>
            <video src={selectedVideo.videoUrl} controls playsInline className="h-full w-full bg-black object-cover" />
          </FrameRenderer>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">
            {loading ? "Loading videos..." : "Upload a video first to preview this frame"}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        This preview updates live as you edit. Click any element to edit its properties instead.
      </p>
    </aside>
  );
}
