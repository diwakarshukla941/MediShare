import { getContainer } from "@cloudflare/containers";
export { MediShareApiContainer } from "./container.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ service: "medishare-api-gateway", status: "ok" });
    }

    return getContainer(env.MEDISHARE_API, "medishare-api-production").fetch(request);
  },
};
