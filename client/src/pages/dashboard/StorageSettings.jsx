import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

const EMPTY = { accountId: "", accessKeyId: "", secretAccessKey: "", bucket: "", publicBaseUrl: "" };
const FIELDS = [["accountId", "Account ID"], ["accessKeyId", "Access key ID"], ["secretAccessKey", "Secret access key", "password"], ["bucket", "Bucket name"], ["publicBaseUrl", "Public CDN / custom-domain URL"]];

export default function StorageSettings() {
  const [values, setValues] = useState(EMPTY);
  const [storage, setStorage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/storage-config").then(({ data }) => setStorage(data.storage)).catch((err) => toast.error(getErrorMessage(err)));
  }, []);
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const { data } = await api.put("/storage-config", { provider: "r2", values: { r2: values } });
      setStorage(data.storage); setValues(EMPTY);
      toast.success("Storage configuration saved");
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setSaving(false); }
  };
  const selectedConfigured = storage?.configured?.r2;
  return <div><Topbar title="Storage & CDN" subtitle="Cloudflare R2 stores all uploaded videos and frame assets." /><div className="max-w-3xl px-4 py-6 sm:px-8"><div className="card p-6"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">R2 credentials are encrypted on the server and are never shown again. Use a public CDN/custom-domain URL so uploaded videos and frames can be served publicly.</div><form className="mt-5 space-y-5" onSubmit={save}><p className="text-sm font-semibold text-slate-900">Cloudflare R2 {selectedConfigured ? "· Configured" : "· Not configured"}</p>{FIELDS.map(([key, label, type]) => <div key={key}><label className="label">{label}</label><input className="input" type={type || "text"} value={values[key]} onChange={(e) => update(key, e.target.value)} placeholder={type === "password" && selectedConfigured ? "Leave blank to keep the saved value" : ""} /></div>)}<button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Cloudflare R2 settings"}</button></form></div></div></div>;
}
