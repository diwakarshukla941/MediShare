import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

const EMPTY = {
  imagekit: { publicKey: "", privateKey: "", urlEndpoint: "", folderPrefix: "/medishare" },
  r2: { accountId: "", accessKeyId: "", secretAccessKey: "", bucket: "", publicBaseUrl: "" },
  gcs: { bucket: "", publicBaseUrl: "", serviceAccountJson: "" },
};

const FIELDS = {
  imagekit: [["publicKey", "Public key"], ["privateKey", "Private key", "password"], ["urlEndpoint", "URL endpoint"], ["folderPrefix", "Folder prefix"]],
  r2: [["accountId", "Account ID"], ["accessKeyId", "Access key ID"], ["secretAccessKey", "Secret access key", "password"], ["bucket", "Bucket name"], ["publicBaseUrl", "Public CDN / custom-domain URL"]],
  gcs: [["bucket", "Bucket name"], ["publicBaseUrl", "Public CDN / bucket URL"], ["serviceAccountJson", "Service-account JSON", "textarea"]],
};

export default function StorageSettings() {
  const [provider, setProvider] = useState("imagekit");
  const [values, setValues] = useState(EMPTY);
  const [storage, setStorage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/storage-config").then(({ data }) => { setStorage(data.storage); setProvider(data.storage.provider); }).catch((err) => toast.error(getErrorMessage(err)));
  }, []);
  const update = (key, value) => setValues((current) => ({ ...current, [provider]: { ...current[provider], [key]: value } }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const { data } = await api.put("/storage-config", { provider, values });
      setStorage(data.storage); setValues((current) => ({ ...current, [provider]: { ...EMPTY[provider] } }));
      toast.success("Storage configuration saved");
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setSaving(false); }
  };
  const selectedConfigured = storage?.configured?.[provider];
  return <div><Topbar title="Storage & CDN" subtitle="Select the storage provider used for new video uploads." /><div className="max-w-3xl px-4 py-6 sm:px-8"><div className="card p-6"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Credentials are encrypted on the server and are never shown again. Existing videos remain with their original provider; switching only affects new uploads.</div><form className="mt-5 space-y-5" onSubmit={save}><div><label className="label">Active provider</label><select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="imagekit">ImageKit</option><option value="r2">Cloudflare R2</option><option value="gcs">Google Cloud Storage</option></select><p className="mt-1 text-xs text-slate-500">{selectedConfigured ? "This provider has saved credentials." : "Not configured yet."} Use a public CDN/custom-domain URL so uploaded videos can be watched publicly.</p></div>{FIELDS[provider].map(([key, label, type]) => <div key={key}><label className="label">{label}</label>{type === "textarea" ? <textarea className="input min-h-36 font-mono text-xs" value={values[provider][key]} onChange={(e) => update(key, e.target.value)} placeholder="Paste the full service-account JSON" /> : <input className="input" type={type || "text"} value={values[provider][key]} onChange={(e) => update(key, e.target.value)} placeholder={type === "password" && selectedConfigured ? "Leave blank to keep the saved value" : ""} />}</div>)}<button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save and activate provider"}</button></form></div><div className="mt-5 text-sm text-slate-600"><p className="font-medium text-slate-900">Provider setup notes</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>ImageKit needs its public key, private key, and URL endpoint.</li><li>R2 needs an S3 API token with read/write access plus a public custom domain.</li><li>Google Cloud Storage needs a service-account JSON with Storage Object Admin access plus a public CDN or bucket URL.</li></ul></div></div></div>;
}
