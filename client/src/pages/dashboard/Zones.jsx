import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => api.get("/zones").then(({ data }) => setZones(data.zones)), []);
  useEffect(() => { load().catch((err) => toast.error(getErrorMessage(err))); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing) await api.patch(`/zones/${editing._id}`, { name });
      else {
        const { data } = await api.post("/zones", { name });
        toast.success(`${data.createdCount} ${data.createdCount === 1 ? "city" : "cities"} added${data.skippedCount ? ` (${data.skippedCount} already existed)` : ""}`);
      }
      setName(""); setEditing(null); await load(); if (editing) toast.success("City updated");
    } catch (err) { toast.error(getErrorMessage(err)); }
  };
  const remove = async () => {
    try { await api.delete(`/zones/${deleting._id}`); setDeleting(null); await load(); toast.success("Zone deleted"); }
    catch (err) { toast.error(getErrorMessage(err)); }
  };

  return <div><Topbar title="Zones" subtitle="Manage the city list available during video upload." /><div className="px-4 py-6 sm:px-8"><form onSubmit={save} className="card max-w-xl p-5"><div className="flex gap-3"><input className="input" required placeholder="e.g. Mumbai, Pune, Bengaluru" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary"><Plus size={16} />{editing ? "Update" : "Add Cities"}</button>{editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setName(""); }}>Cancel</button>}</div>{!editing && <p className="mt-2 text-xs text-slate-500">Add multiple cities at once by separating them with commas.</p>}</form><div className="card mt-6 max-w-xl divide-y divide-slate-100">{zones.map((zone) => <div key={zone._id} className="flex items-center justify-between p-4"><span>{zone.name}</span><div><button className="p-2 text-slate-500" onClick={() => { setEditing(zone); setName(zone.name); }}><Pencil size={16} /></button><button className="p-2 text-red-500" onClick={() => setDeleting(zone)}><Trash2 size={16} /></button></div></div>)}{zones.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No zones yet.</p>}</div></div><ConfirmDialog open={Boolean(deleting)} title="Delete this zone?" message={`Remove "${deleting?.name}" from the selectable zones? Existing videos keep their saved zone.`} onConfirm={remove} onCancel={() => setDeleting(null)} /></div>;
}
