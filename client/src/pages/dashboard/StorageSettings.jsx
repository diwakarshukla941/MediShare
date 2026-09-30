import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

const variables = [
  ["CLOUDFLARE_ACCOUNT_ID", "Cloudflare account ID"],
  ["CLOUDFLARE_ACCESS_KEY_ID", "R2 access key ID (secret)"],
  ["CLOUDFLARE_SECRET_ACCESS_KEY", "R2 secret access key (secret)"],
  ["CLOUDFLARE_BUCKET_NAME", "R2 bucket name"],
  ["CLOUDFLARE_PUBLIC_DOMAIN", "R2 public custom-domain URL"],
  ["CLOUDFLARE_FOLDER_PREFIX", "R2 object prefix (required)"],
];

export default function StorageSettings() {
  const [configured, setConfigured] = useState(null);

  useEffect(() => {
    api.get("/storage-config")
      .then(({ data }) => setConfigured(Boolean(data.storage?.configured?.r2)))
      .catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  return <div>
    <Topbar title="Storage & CDN" subtitle="Cloudflare R2 stores uploaded videos and frame assets." />
    <div className="max-w-3xl px-4 py-6 sm:px-8">
      <div className="card space-y-5 p-6">
        <p className="text-sm font-semibold text-slate-900">
          Cloudflare R2 {configured === null ? "· Checking configuration…" : configured ? "· Environment configured" : "· Environment incomplete"}
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          R2 settings are read only from the <strong>bonconnect-api Worker environment</strong>. Values saved in the application database are ignored. After changing Worker variables or secrets, redeploy the Worker so its Container receives them.
        </div>
        <p className="text-sm text-slate-600">In Cloudflare, open <strong>Workers & Pages → bonconnect-api → Settings → Variables and secrets</strong> and configure:</p>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {variables.map(([name, description]) => <div key={name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="text-sm font-semibold text-slate-800">{name}</code>
            <span className="text-sm text-slate-500">{description}</span>
          </div>)}
        </div>
        <p className="text-sm text-slate-600">
          Screenshots of the current bucket show active objects under <code>bonconnect/bonconnect/</code> and legacy objects under <code>bonconnect/medishare/</code>. Set <code>CLOUDFLARE_FOLDER_PREFIX</code> to <code>bonconnect/bonconnect</code> to keep new uploads beside the active videos and frames. Create the access key and secret in R2 API Tokens with Object Read &amp; Write access limited to this bucket. Use the bucket’s public custom domain for <code>CLOUDFLARE_PUBLIC_DOMAIN</code>. Do not enter the word <code>undefined</code> for any value.
        </p>
      </div>
    </div>
  </div>;
}
