import { useCallback, useEffect, useState } from "react";
import {
  UserPlus,
  Upload,
  Download,
  ShieldOff,
  ShieldCheck,
  Trash2,
  KeyRound,
  Pencil,
  Tags,
} from "lucide-react";
import toast from "react-hot-toast";
import Topbar from "../../components/dashboard/Topbar.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { api, getErrorMessage } from "../../lib/api.js";

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Team() {
  const { admin: me } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessModal, setAccessModal] = useState(null); // null | "new" | admin object
  const [roleModal, setRoleModal] = useState(null); // null | "new" | role object
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isSuperAdmin = me?.role === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    const [adminsRes, rolesRes, catalogRes] = await Promise.all([
      api.get("/admins"),
      api.get("/roles"),
      api.get("/roles/permissions"),
    ]);
    setAdmins(adminsRes.data.admins);
    setRoles(rolesRes.data.roles);
    setCatalog(catalogRes.data.permissions);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadSample = async () => {
    const { data } = await api.get("/admins/sample-csv", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medishare-team-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      toast.error("Choose a CSV or Excel file first");
      return;
    }
    const data = new FormData();
    data.append("sheet", bulkFile);
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const { data: res } = await api.post("/admins/bulk", data);
      setBulkResult(res);
      if (res.createdCount > 0) {
        toast.success(`${res.createdCount} account(s) created`);
        setBulkFile(null);
        load();
      }
      if (res.errorCount > 0) toast.error(`${res.errorCount} row(s) failed`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBulkUploading(false);
    }
  };

  const toggleActive = async (row) => {
    setBusyId(row._id);
    try {
      await api.patch(`/admins/${row._id}`, { isActive: !row.isActive });
      toast.success(row.isActive ? "Account deactivated" : "Account activated");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(deleting._id);
    try {
      await api.delete(`/admins/${deleting._id}`);
      toast.success("Account deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDeleteRole = async () => {
    setBusyId(deletingRole._id);
    try {
      await api.delete(`/roles/${deletingRole._id}`, { params: { confirm: "true" } });
      toast.success("Role deleted");
      setDeletingRole(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <Topbar title="Team & Access" subtitle="Create accounts, define roles, and control who can access what." />

      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => setAccessModal("new")} className="btn-primary">
            <UserPlus size={16} />
            Add Account
          </button>
          <button onClick={() => setRoleModal("new")} className="btn-secondary">
            <Tags size={16} />
            New Role
          </button>
          <button onClick={downloadSample} className="btn-secondary">
            <Download size={16} />
            Download Sample CSV
          </button>
        </div>

        {/* Roles */}
        <div className="card mb-6 max-w-3xl p-5">
          <p className="label mb-3">Roles</p>
          {roles.length === 0 ? (
            <p className="text-xs text-slate-400">No roles yet — create one to reuse across accounts.</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {role.name}{" "}
                      <span className="font-normal text-slate-400">
                        · {role.assignedCount} account{role.assignedCount === 1 ? "" : "s"}
                      </span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {role.permissions.length === 0 ? (
                        <span className="text-xs text-slate-400">No permissions</span>
                      ) : (
                        role.permissions.map((p) => (
                          <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {catalog.find((c) => c.key === p)?.label || p}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setRoleModal(role)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeletingRole(role)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk create */}
        <form onSubmit={submitBulk} className="card mb-6 max-w-2xl space-y-3 p-5">
          <label className="label">Bulk Create Accounts (CSV / Excel)</label>
          <p className="text-xs text-slate-500">
            Columns: <code className="rounded bg-slate-100 px-1">name, email, password, role</code>. Leave{" "}
            <code className="rounded bg-slate-100 px-1">password</code> blank to auto-generate one. Bulk rows get no
            named role — assign one afterward with the pencil icon below.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer">
              <Upload size={15} />
              {bulkFile ? bulkFile.name : "Choose CSV/Excel File"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={bulkUploading || !bulkFile}>
              {bulkUploading ? "Creating..." : "Create Accounts"}
            </button>
          </div>

          {bulkResult && (
            <div className="space-y-2 pt-1">
              {bulkResult.created.length > 0 && (
                <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-800">
                  <p className="font-semibold">{bulkResult.created.length} account(s) created</p>
                  <ul className="mt-1 space-y-1">
                    {bulkResult.created.map((a) => (
                      <li key={a.id} className="flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        {a.name} — {a.email}
                        {a.generatedPassword && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 font-mono">
                            <KeyRound size={10} />
                            {a.generatedPassword}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {bulkResult.errors.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-semibold">{bulkResult.errors.length} row(s) failed</p>
                  <ul className="mt-1 space-y-0.5">
                    {bulkResult.errors.map((e, i) => (
                      <li key={i}>
                        {e.email}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </form>

        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name &amp; Email</th>
                    <th className="px-5 py-3 font-medium">Access</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map((row) => {
                    const isSelf = String(row._id) === String(me?.id);
                    return (
                      <tr key={row._id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">
                            {row.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                          {row.location && <p className="text-xs text-slate-400">{row.location}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          {row.role === "super_admin" ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                              Super Admin
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {row.roleId?.name || "No role"}
                              </span>
                              {row.permissions?.length > 0 && (
                                <span className="text-[10px] text-slate-400">{row.permissions.length} permission(s)</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{formatDate(row.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              title="Edit access"
                              onClick={() => setAccessModal(row)}
                              disabled={row.role === "super_admin" && !isSuperAdmin}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              title={row.isActive ? "Deactivate" : "Activate"}
                              onClick={() => toggleActive(row)}
                              disabled={isSelf || busyId === row._id}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ShieldOff size={16} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => setDeleting(row)}
                              disabled={isSelf}
                              className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {accessModal && (
        <AccessModal
          existing={accessModal === "new" ? null : accessModal}
          roles={roles}
          catalog={catalog}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setAccessModal(null)}
          onSaved={() => {
            setAccessModal(null);
            load();
          }}
        />
      )}

      {roleModal && (
        <RoleModal
          existing={roleModal === "new" ? null : roleModal}
          catalog={catalog}
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            setRoleModal(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this account?"
        message={`"${deleting?.name}" will lose access immediately and be permanently removed.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={busyId === deleting?._id}
      />

      <ConfirmDialog
        open={Boolean(deletingRole)}
        title="Delete this role?"
        message={
          deletingRole?.assignedCount > 0
            ? `"${deletingRole?.name}" is assigned to ${deletingRole?.assignedCount} account(s) — they'll lose the permissions it granted.`
            : `"${deletingRole?.name}" will be permanently deleted.`
        }
        onConfirm={confirmDeleteRole}
        onCancel={() => setDeletingRole(null)}
        loading={busyId === deletingRole?._id}
      />
    </div>
  );
}

function RoleModal({ existing, catalog, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || "");
  const [permissions, setPermissions] = useState(new Set(existing?.permissions || []));
  const [saving, setSaving] = useState(false);

  const toggle = (key) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, permissions: [...permissions] };
      if (existing) await api.patch(`/roles/${existing._id}`, payload);
      else await api.post("/roles", payload);
      toast.success(existing ? "Role updated" : "Role created");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{existing ? "Edit Role" : "New Role"}</h3>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="label">Role Name</label>
            <input className="input" required placeholder="e.g. HR" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Permissions</label>
            {catalog.length === 0 ? (
              <p className="text-xs text-slate-400">You don't have any grantable permissions yourself.</p>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {catalog.map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={permissions.has(p.key)}
                      onChange={() => toggle(p.key)}
                    />
                    <span>
                      <span className="font-medium text-slate-800">{p.label}</span>
                      <span className="block text-xs text-slate-400">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : existing ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccessModal({ existing, roles, catalog, isSuperAdmin, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState(existing?.location || "");
  const [accountType, setAccountType] = useState(existing?.role || "admin");
  const [roleId, setRoleId] = useState(existing?.roleId?._id || existing?.roleId || "");
  const [permissions, setPermissions] = useState(new Set(existing?.permissions || []));
  const [saving, setSaving] = useState(false);

  const selectedRolePerms = roles.find((r) => r._id === roleId)?.permissions || [];

  const applyRole = (id) => {
    setRoleId(id);
    const rolePerms = roles.find((r) => r._id === id)?.permissions || [];
    setPermissions(new Set(rolePerms));
  };

  const toggle = (key) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, location, role: accountType };
      if (!existing) {
        payload.email = email;
        payload.password = password;
      }
      if (accountType !== "super_admin") {
        payload.roleId = roleId || null;
        payload.permissionOverrides = {
          add: [...permissions].filter((p) => !selectedRolePerms.includes(p)),
          remove: selectedRolePerms.filter((p) => !permissions.has(p)),
        };
      }

      if (existing) await api.patch(`/admins/${existing._id}`, payload);
      else await api.post("/admins", payload);
      toast.success(existing ? "Access updated" : "Account created");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{existing ? "Edit Access" : "Add Account"}</h3>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              placeholder="e.g. Mumbai, Maharashtra"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          {!existing && (
            <>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="text"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {isSuperAdmin && (
            <div>
              <label className="label">Account Type</label>
              <select className="input" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="admin">Admin (permission-based access)</option>
                <option value="super_admin">Super Admin (full, unrestricted access)</option>
              </select>
            </div>
          )}

          {accountType !== "super_admin" && (
            <>
              <div>
                <label className="label">Role</label>
                <select className="input" value={roleId} onChange={(e) => applyRole(e.target.value)}>
                  <option value="">No role — custom only</option>
                  {roles.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Fine-tune Permissions</label>
                <p className="mb-2 text-xs text-slate-400">
                  Pre-filled from the role above — check or uncheck individual boxes to grant or remove access just
                  for this person.
                </p>
                {catalog.length === 0 ? (
                  <p className="text-xs text-slate-400">You don't have any grantable permissions yourself.</p>
                ) : (
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    {catalog.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={permissions.has(p.key)} onChange={() => toggle(p.key)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : existing ? "Save Changes" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
