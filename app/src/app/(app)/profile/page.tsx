"use client";

import { useState, type FormEvent } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader } from "@/components/ui";
import type { SessionUser } from "@/lib/auth/session";
import type { UserPermissions } from "@/lib/auth/permissions";

interface MeData {
  user: SessionUser;
  permissions: UserPermissions;
}

const TIER_LABELS: Record<number, string> = {
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
  4: "Level 4",
  5: "Level 5",
  6: "Director / Admin",
};


export default function ProfilePage() {
  const { data, loading, error, refetch } = useApi<MeData>("/api/me");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load profile" description="Please refresh." />;

  const { user, permissions } = data;

  function startEdit() {
    setDisplayName(user.displayName);
    setEditing(true);
    setSaved(false);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await apiClient.patch("/api/me", { displayName: displayName.trim() });
      setSaved(true);
      setEditing(false);
      refetch();
    } finally { setSaving(false); }
  }

  const enabledModules = Object.entries(permissions.modules)
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Your account details and access settings." />

      {/* Avatar + identity card */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-200" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <form onSubmit={saveEdit} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-bold text-gray-900 focus:border-brand-500 focus:outline-none"
                />
                <Button size="sm" type="submit" loading={saving}>Save</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 truncate">{user.displayName}</h2>
                <button
                  onClick={startEdit}
                  className="shrink-0 rounded p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  title="Edit display name"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {saved && <span className="text-xs text-success-600">✓ Saved</span>}
              </div>
            )}
            <p className="mt-0.5 text-sm text-gray-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5">
          <div>
            <p className="text-xs font-medium text-gray-500">Tier</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {permissions.tier} — {TIER_LABELS[permissions.tier] ?? "Staff"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Admin access</p>
            <p className="mt-0.5">
              <Badge variant={permissions.isAdmin ? "success" : "neutral"}>{permissions.isAdmin ? "Yes" : "No"}</Badge>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Status</p>
            <p className="mt-0.5">
              <Badge variant={user.isArchived ? "error" : "success"}>{user.isArchived ? "Archived" : "Active"}</Badge>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">User ID</p>
            <p className="mt-0.5 text-sm font-mono text-gray-500">#{user.id}</p>
          </div>
        </div>
      </div>

      {/* Enabled modules */}
      {enabledModules.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Access & Modules</h3>
          <div className="flex flex-wrap gap-2">
            {enabledModules.map(m => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Password change note */}
      <p className="text-center text-xs text-gray-400">
        To change your password, use the password reset link on the login page.
      </p>
    </div>
  );
}
