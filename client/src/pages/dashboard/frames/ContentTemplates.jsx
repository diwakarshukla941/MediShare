import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../../../lib/api.js";
import ConfirmDialog from "../../../components/ConfirmDialog.jsx";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";
const emptyDoctorForm = { doctorEmail: "", title: "", description: "" };

function DoctorTemplateForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial._id);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = isEdit
        ? await api.patch(`/content-templates/doctor/${initial._id}`, {
            title: form.title,
            description: form.description,
          })
        : await api.post("/content-templates/doctor", form);
      toast.success(isEdit ? "Override updated" : "Override added");
      onSaved(data.template);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <label className="label">Doctor Email</label>
        <input
          className="input"
          type="email"
          required
          disabled={isEdit}
          placeholder="doctor@clinic.com"
          value={form.doctorEmail}
          onChange={update("doctorEmail")}
        />
      </div>
      <div>
        <label className="label">Title</label>
        <input className="input" placeholder="Health Tips for Good Sleep" value={form.title} onChange={update("title")} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Shown to patients on the watch page"
          value={form.description}
          onChange={update("description")}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary !py-2 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary !py-2 text-xs" disabled={saving}>
          {saving ? "Saving..." : "Save Override"}
        </button>
      </div>
    </form>
  );
}

export default function ContentTemplates() {
  const [defaultTemplate, setDefaultTemplate] = useState({ title: "", description: "" });
  const [doctorTemplates, setDoctorTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [editingId, setEditingId] = useState(null); // "_new" | template._id | null
  const [deleting, setDeleting] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get("/content-templates");
    setDefaultTemplate({ title: data.defaultTemplate?.title || "", description: data.defaultTemplate?.description || "" });
    setDoctorTemplates(data.doctorTemplates);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveDefault = async (e) => {
    e.preventDefault();
    setSavingDefault(true);
    try {
      await api.put("/content-templates/default", defaultTemplate);
      toast.success("Default template saved");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingDefault(false);
    }
  };

  const confirmDelete = async () => {
    setBusyDelete(true);
    try {
      await api.delete(`/content-templates/doctor/${deleting._id}`);
      toast.success("Override deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <Link to={FRAME_STUDIO_BASE} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Back to Frames">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Content Templates</h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Owner-only — controls the title &amp; description shown on every video. Not visible to the client.
          </p>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-8">
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        ) : (
          <div className="space-y-6">
            <form onSubmit={saveDefault} className="card max-w-lg space-y-4 p-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Default Title &amp; Description</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Used for every uploaded video unless the doctor's email matches an override below.
                </p>
              </div>
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  placeholder="Health Tips for Good Sleep"
                  value={defaultTemplate.title}
                  onChange={(e) => setDefaultTemplate((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Shown to patients on the watch page"
                  value={defaultTemplate.description}
                  onChange={(e) => setDefaultTemplate((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={savingDefault}>
                {savingDefault ? "Saving..." : "Save Default"}
              </button>
            </form>

            <div className="card max-w-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Doctor-Specific Overrides</h2>
                  <p className="mt-1 text-xs text-slate-500">Match by the doctor's email — takes priority over the default.</p>
                </div>
                {editingId === null && (
                  <button onClick={() => setEditingId("_new")} className="btn-secondary !py-2 text-xs">
                    <Plus size={13} />
                    Add Override
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {editingId === "_new" && (
                  <DoctorTemplateForm
                    initial={emptyDoctorForm}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      load();
                    }}
                  />
                )}

                {doctorTemplates.length === 0 && editingId !== "_new" && (
                  <p className="py-4 text-center text-xs text-slate-400">No doctor-specific overrides yet.</p>
                )}

                {doctorTemplates.map((t) =>
                  editingId === t._id ? (
                    <DoctorTemplateForm
                      key={t._id}
                      initial={t}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => {
                        setEditingId(null);
                        load();
                      }}
                    />
                  ) : (
                    <div key={t._id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{t.doctorEmail}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{t.title || "(no title)"}</p>
                        {t.description && <p className="mt-0.5 truncate text-xs text-slate-400">{t.description}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => setEditingId(t._id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(t)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this override?"
        message={`Videos from "${deleting?.doctorEmail}" will fall back to the default title/description for future uploads.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={busyDelete}
      />
    </div>
  );
}
