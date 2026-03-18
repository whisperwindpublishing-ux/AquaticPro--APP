"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { FullPageSpinner, PageHeader, Button, Badge, EmptyState } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface JobRole {
  id: number;
  title: string;
  tier: number;
  description: string | null;
  inserviceHours: number;
  userCount: number;
}

interface RolesData { roles: JobRole[] }

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 — Entry",
  2: "Tier 2 — Mid",
  3: "Tier 3 — Senior",
  4: "Tier 4 — Lead",
  5: "Tier 5 — Director",
  6: "Tier 6 — Admin",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-700",
  3: "bg-sky-100 text-sky-700",
  4: "bg-violet-100 text-violet-700",
  5: "bg-orange-100 text-orange-700",
  6: "bg-red-100 text-red-700",
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

// ─── Role Form (create / edit) ────────────────────────────────────────────────

interface RoleFormProps {
  initial?: JobRole | null;
  onSave: (role: JobRole) => void;
  onCancel: () => void;
}

function RoleForm({ initial, onSave, onCancel }: RoleFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tier, setTier] = useState(String(initial?.tier ?? "1"));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [inserviceHours, setInserviceHours] = useState(String(initial?.inserviceHours ?? "4"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        tier: parseInt(tier),
        description: description.trim() || null,
        inserviceHours: parseFloat(inserviceHours) || 4,
      };
      let data: { role: JobRole };
      if (initial) {
        data = await apiClient.put<{ role: JobRole }>(`/api/admin/roles/${initial.id}`, payload);
      } else {
        data = await apiClient.post<{ role: JobRole }>("/api/admin/roles", payload);
      }
      onSave(data.role);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save role.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {initial ? "Edit Job Role" : "New Job Role"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lifeguard, Head Guard, Pool Manager"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier *</label>
              <select
                className={inputClass}
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((t) => (
                  <option key={t} value={t}>{TIER_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">In-service Hours</label>
              <input
                type="number"
                min={0}
                max={99}
                step={0.5}
                className={inputClass}
                value={inserviceHours}
                onChange={(e) => setInserviceHours(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — describe this role's responsibilities"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button type="submit" loading={saving}>
              {initial ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { data: meData, loading: permLoading } = usePermissions();
  const permissions = meData?.permissions;
  const { data, loading, refetch } = useApi<RolesData>("/api/admin/roles");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<JobRole | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  if (permLoading || loading) return <FullPageSpinner />;
  if (!permissions?.isAdmin) {
    return (
      <EmptyState
        title="Access Denied"
        description="Admin access is required to manage job roles."
      />
    );
  }

  const roles = data?.roles ?? [];

  function handleSaved(role: JobRole) {
    setCreating(false);
    setEditing(null);
    refetch?.();
    void role;
  }

  async function handleDelete(role: JobRole) {
    if (role.userCount > 0) {
      alert(`Cannot delete "${role.title}" — ${role.userCount} user(s) are assigned to this role. Reassign them first.`);
      return;
    }
    if (!confirm(`Delete the role "${role.title}"? This cannot be undone.`)) return;
    setDeleting(role.id);
    try {
      await apiClient.delete(`/api/admin/roles/${role.id}`);
      refetch?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete role.";
      alert(msg);
    } finally {
      setDeleting(null);
    }
  }

  // Group roles by tier
  const byTier = roles.reduce<Record<number, JobRole[]>>((acc, r) => {
    (acc[r.tier] ??= []).push(r);
    return acc;
  }, {});
  const tiers = [6, 5, 4, 3, 2, 1].filter((t) => byTier[t]?.length);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Job Roles"
        subtitle="Create and manage job roles, tiers, and module permissions."
        right={
          <Button onClick={() => setCreating(true)}>
            + New Role
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Roles</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{roles.reduce((n, r) => n + r.userCount, 0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Users Assigned</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{new Set(roles.map((r) => r.tier)).size}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tier Levels Used</p>
        </div>
      </div>

      {roles.length === 0 ? (
        <EmptyState
          title="No job roles yet"
          description="Create your first job role to start assigning permissions to staff."
          action={<Button onClick={() => setCreating(true)}>Create First Role</Button>}
        />
      ) : (
        <div className="space-y-6">
          {tiers.map((tier) => (
            <div key={tier}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[tier]}`}>
                  {TIER_LABELS[tier]}
                </span>
                <span className="text-xs text-gray-400">{byTier[tier].length} role{byTier[tier].length !== 1 ? "s" : ""}</span>
              </div>

              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                {byTier[tier].map((role) => (
                  <div key={role.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Role info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{role.title}</p>
                      {role.description && (
                        <p className="mt-0.5 text-sm text-gray-500 truncate">{role.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <UsersIcon />
                          {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                        </span>
                        <span>{role.inserviceHours}h in-service</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/roles/${role.id}/permissions`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                      >
                        <ShieldIcon />
                        Permissions
                      </Link>
                      <button
                        onClick={() => setEditing(role)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
                      >
                        <PencilIcon />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        disabled={deleting === role.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-medium text-red-500 hover:border-red-200 hover:text-red-700 disabled:opacity-50 transition-colors"
                      >
                        <TrashIcon />
                        {deleting === role.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {creating && (
        <RoleForm onSave={handleSaved} onCancel={() => setCreating(false)} />
      )}
      {editing && (
        <RoleForm initial={editing} onSave={handleSaved} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}
