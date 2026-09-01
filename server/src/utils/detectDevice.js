export function detectDevice(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (!ua) return "other";
  if (/ipad|tablet|nexus 7|nexus 10|kindle|playbook/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua)) return "mobile";
  if (/android/.test(ua)) return "tablet";
  if (/windows|macintosh|linux|x11/.test(ua)) return "desktop";
  return "other";
}
