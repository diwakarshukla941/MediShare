import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../lib/api.js";
import ZoneField from "./ZoneField.jsx";

export default function EditVideoModal({ video, onClose, onSaved }) {
  const [form, setForm] = useState({
    doctorName: video.doctorName || "",
    credentials: video.credentials || "",
    empId: video.empId || "",
    zone: video.zone || "",
    phone: video.phone || "",
  });
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch(`/videos/${video._id}`, form);
      toast.success("Video info updated");
      onSaved(data.video);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Edit Video Info</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Doctor Name</label>
              <input className="input" value={form.doctorName} onChange={update("doctorName")} required />
            </div>
            <div>
              <label className="label">Credentials</label>
              <input className="input" value={form.credentials} onChange={update("credentials")} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID</label>
              <input className="input" value={form.empId} onChange={update("empId")} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={update("phone")} required />
            </div>
            <div>
              <ZoneField value={form.zone} onChange={update("zone")} />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
