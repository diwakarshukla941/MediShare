import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../../../lib/api.js";

const FRAME_STUDIO_BASE = "/dashboard/frame-studio-1845fd3e26ad";

export default function ContentTemplates() {
  const [template, setTemplate] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/content-templates");
      setTemplate({ title: data.defaultTemplate?.title || "", description: data.defaultTemplate?.description || "" });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put("/content-templates/default", template);
      toast.success("Default template saved");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <Link to={FRAME_STUDIO_BASE} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Back to Frames">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Content Template</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Default title and description for every newly uploaded video.</p>
        </div>
      </header>
      <div className="px-4 py-6 sm:px-8">
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        ) : (
          <form onSubmit={save} className="card max-w-lg space-y-4 p-6">
            <div>
              <label className="label">Title</label>
              <input className="input" value={template.title} onChange={(e) => setTemplate((current) => ({ ...current, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={template.description} onChange={(e) => setTemplate((current) => ({ ...current, description: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Default"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
