const KEY = "medishare_session";

export function getSessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function sendWatchBeacon(videoId, seconds) {
  if (!videoId || !seconds || seconds < 1) return;
  const payload = JSON.stringify({ sessionId: getSessionId(), seconds: Math.round(seconds) });
  const blob = new Blob([payload], { type: "application/json" });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`/api/videos/${videoId}/track-watch`, blob);
  } else {
    fetch(`/api/videos/${videoId}/track-watch`, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}
