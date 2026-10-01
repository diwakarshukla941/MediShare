import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Share2, Download, Play, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../components/Logo.jsx";
import CopyLinkField from "../components/CopyLinkField.jsx";
import FrameRenderer from "../components/FrameRenderer.jsx";
import VideoControls from "../components/VideoControls.jsx";
import { api } from "../lib/api.js";
import { getSessionId, sendWatchBeacon } from "../lib/session.js";
import { downloadFramedVideo, getDownloadErrorMessage } from "../lib/downloadVideo.js";
import { brand } from "../config/brand.js";

const WATCH_BEACON_INTERVAL_MS = 20000;

export default function WatchVideo() {
  const { slug } = useParams();
  const [video, setVideo] = useState(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("loading");
  const [downloading, setDownloading] = useState(false);
  const [renderError, setRenderError] = useState("");
  const videoRef = useRef(null);
  const maxWatchedRef = useRef(0);
  const lastSentRef = useRef(0);
  const trackedSlugRef = useRef(null);

  useEffect(() => {
    // Guard against React StrictMode's dev-only double-invoke of this effect,
    // which would otherwise double-count the view for every real page load.
    if (trackedSlugRef.current === slug) return;
    trackedSlugRef.current = slug;

    Promise.all([
      api.get(`/videos/public/${slug}`, { params: { sid: getSessionId() } }),
      api.get("/frames/active"),
    ])
      .then(([videoRes, frameRes]) => {
        setVideo(videoRes.data.video);
        setFrame(frameRes.data.frame);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug]);

  useEffect(() => {
    if (!video || video.renderingStatus !== "processing") return undefined;
    let cancelled = false;
    let timer;
    const pollRenderStatus = async () => {
      try {
        const { data } = await api.get(`/videos/public/${slug}/status`);
        if (cancelled) return;
        if (data.renderingStatus === "completed") {
          setVideo((current) => ({
            ...current,
            renderingStatus: "completed",
            videoUrl: data.videoUrl || current.videoUrl,
            thumbnailUrl: data.thumbnailUrl || current.thumbnailUrl,
            frameBakedId: data.frameBakedId || current.frameBakedId,
            frameBakedVersion: data.frameBakedVersion || current.frameBakedVersion,
          }));
          return;
        }
        if (data.renderingStatus === "failed") {
          setRenderError(data.renderingError || "The framed video could not be prepared. Please contact the administrator.");
          setVideo((current) => ({ ...current, renderingStatus: "failed" }));
          return;
        }
      } catch {
        // A brief API/network interruption should keep the pending state and retry.
      }
      if (!cancelled) timer = setTimeout(pollRenderStatus, 5000);
    };
    timer = setTimeout(pollRenderStatus, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [slug, video?.renderingStatus]);

  useEffect(() => {
    if (status !== "ready" || !video) return undefined;

    const flush = () => {
      const unsent = maxWatchedRef.current - lastSentRef.current;
      if (unsent > 0) {
        sendWatchBeacon(video._id, unsent);
        lastSentRef.current = maxWatchedRef.current;
      }
    };

    const onTimeUpdate = () => {
      const t = videoRef.current?.currentTime || 0;
      if (t > maxWatchedRef.current) maxWatchedRef.current = t;
    };

    const interval = setInterval(flush, WATCH_BEACON_INTERVAL_MS);
    const onHide = () => document.visibilityState === "hidden" && flush();

    const el = videoRef.current;
    el?.addEventListener("timeupdate", onTimeUpdate);
    el?.addEventListener("pause", flush);
    el?.addEventListener("ended", flush);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      clearInterval(interval);
      el?.removeEventListener("timeupdate", onTimeUpdate);
      el?.removeEventListener("pause", flush);
      el?.removeEventListener("ended", flush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [status, video]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title || video.doctorName, url });
        api.post(`/videos/${video._id}/share`).catch(() => {});
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
      api.post(`/videos/${video._id}/share`).catch(() => {});
    } catch {
      toast.error("Could not copy link");
    }
  };

  const download = async () => {
    setDownloading(true);
    const toastId = toast.loading("Preparing your video with the frame — this can take a moment...");
    try {
      await downloadFramedVideo(video._id, {
        slug,
        onStatus: (message) => toast.loading(message, { id: toastId }),
      });
      toast.success("Your video is ready", { id: toastId });
    } catch (err) {
      toast.error(await getDownloadErrorMessage(err), { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "error" || !video) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <Logo />
        <h1 className="text-lg font-semibold text-slate-900">Video not found</h1>
        <p className="text-sm text-slate-500">This link may have been removed or is no longer available.</p>
      </div>
    );
  }

  const watchUrl = window.location.href;
  const hasMatchingBakedFrame = Boolean(
    video.frameBakedId && frame && String(video.frameBakedId) === String(frame._id)
  );
  const needsLegacyDynamicTextOverlay = hasMatchingBakedFrame && !video.frameBakedVersion;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:px-10">
        <Logo />
        <div className="flex gap-2">
          <button onClick={download} className="btn-secondary" disabled={downloading}>
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {downloading ? "Downloading..." : "Download"}
          </button>
          <button onClick={share} className="btn-primary">
            <Share2 size={15} />
            Share Video
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative">
          {video.renderingStatus === "processing" && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" aria-live="polite">
              <Loader2 size={18} className="shrink-0 animate-spin" />
              <span>Your video is available to preview. We’re preparing the framed download; it will be ready here automatically.</span>
            </div>
          )}
          {video.renderingStatus === "failed" && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
              {renderError || "The framed version could not be prepared. Please contact the administrator."}
            </div>
          )}
          {/* Older baked videos may have blank variable fields. Overlay only
              those fields when this exact frame was baked into the file. */}
          {needsLegacyDynamicTextOverlay ? (
            <div className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
              <video ref={videoRef} src={video.videoUrl} poster={video.thumbnailUrl || undefined} playsInline className="block h-full w-full bg-black object-contain" />
              <FrameRenderer frame={frame} video={video} dynamicTextOnly />
            </div>
          ) : (
            <FrameRenderer frame={video.frameBakedId ? null : frame} video={video}>
              <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl || undefined}
                playsInline
                className={video.frameBakedId || !frame ? "block h-auto w-full bg-black" : "h-full w-full bg-black object-cover"}
              />
            </FrameRenderer>
          )}
          {/* Custom bar spans the whole frame's bottom edge, not just the video
              window — the native browser controls only ever hug the <video>
              element itself, which looks disconnected on a portrait frame. */}
          <VideoControls videoRef={videoRef} />
        </div>

        <div className="mt-6">
          {video.title && <h1 className="text-lg font-bold text-slate-900">{video.title}</h1>}
          <p className="mt-1 text-sm text-slate-500">
            {video.doctorName} &middot; {video.credentials}
            {video.zone ? ` · ${video.zone}` : ""}
          </p>
          {video.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{video.description}</p>}
        </div>

        <div className="mt-6">
          <p className="label">Video Link</p>
          <CopyLinkField url={watchUrl} onCopied={() => api.post(`/videos/${video._id}/share`).catch(() => {})} />
        </div>

        <div className="mt-10 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Play size={12} fill="currentColor" />
          Powered by {brand.poweredBy}
        </div>
        <div className="text-xs text-center mt-2 flex gap-4 justify-center  text-slate-400">
          <telphone> &bull; +917021333878</telphone>
          <p> &bull; raghuboyar6@gmail.com</p>
        </div>
      </main>
    </div>
  );
}
