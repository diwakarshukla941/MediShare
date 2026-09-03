import { useState } from "react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, getErrorMessage } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Settings() {
  const { admin } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password updated");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Topbar title="Settings" subtitle="Manage your account." />

      <div className="px-4 py-6 sm:px-8">
        <div className="card max-w-lg p-6">
          <h2 className="text-sm font-semibold text-slate-900">Account</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>
              <span className="text-slate-400">Name:</span> {admin?.name}
            </p>
            <p>
              <span className="text-slate-400">Email:</span> {admin?.email}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="card mt-6 max-w-lg space-y-4 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              required
              value={form.currentPassword}
              onChange={update("currentPassword")}
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.newPassword}
              onChange={update("newPassword")}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
