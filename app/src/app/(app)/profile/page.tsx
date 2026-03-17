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
    <div className="ap-mx-auto ap-max-w-2xl ap-space-y-6">
      <PageHeader title="My Profile" description="Your account details and access settings." />

      {/* Avatar + identity card */}
      <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-6 ap-shadow-sm">
        <div className="ap-flex ap-items-center ap-gap-5">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="ap-h-16 ap-w-16 ap-rounded-full ap-object-cover ap-ring-2 ap-ring-brand-200" />
          ) : (
            <div className="ap-flex ap-h-16 ap-w-16 ap-shrink-0 ap-items-center ap-justify-center ap-rounded-full ap-bg-brand-100 ap-text-2xl ap-font-bold ap-text-brand-700">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="ap-flex-1 ap-min-w-0">
            {editing ? (
              <form onSubmit={saveEdit} className="ap-flex ap-items-center ap-gap-2">
                <input
                  autoFocus
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="ap-flex-1 ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-1.5 ap-text-lg ap-font-bold ap-text-gray-900 focus:ap-border-brand-500 focus:ap-outline-none"
                />
                <Button size="sm" type="submit" loading={saving}>Save</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
              </form>
            ) : (
              <div className="ap-flex ap-items-center ap-gap-2">
                <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-truncate">{user.displayName}</h2>
                <button
                  onClick={startEdit}
                  className="ap-shrink-0 ap-rounded ap-p-1 ap-text-gray-400 hover:ap-text-brand-600 hover:ap-bg-brand-50 ap-transition-colors"
                  title="Edit display name"
                >
                  <svg className="ap-h-3.5 ap-w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {saved && <span className="ap-text-xs ap-text-success-600">✓ Saved</span>}
              </div>
            )}
            <p className="ap-mt-0.5 ap-text-sm ap-text-gray-500 ap-truncate">{user.email}</p>
          </div>
        </div>

        <div className="ap-mt-5 ap-grid ap-grid-cols-2 ap-gap-4 ap-border-t ap-border-gray-100 ap-pt-5">
          <div>
            <p className="ap-text-xs ap-font-medium ap-text-gray-500">Tier</p>
            <p className="ap-mt-0.5 ap-text-sm ap-font-semibold ap-text-gray-900">
              {permissions.tier} — {TIER_LABELS[permissions.tier] ?? "Staff"}
            </p>
          </div>
          <div>
            <p className="ap-text-xs ap-font-medium ap-text-gray-500">Admin access</p>
            <p className="ap-mt-0.5">
              <Badge variant={permissions.isAdmin ? "success" : "neutral"}>{permissions.isAdmin ? "Yes" : "No"}</Badge>
            </p>
          </div>
          <div>
            <p className="ap-text-xs ap-font-medium ap-text-gray-500">Status</p>
            <p className="ap-mt-0.5">
              <Badge variant={user.isArchived ? "error" : "success"}>{user.isArchived ? "Archived" : "Active"}</Badge>
            </p>
          </div>
          <div>
            <p className="ap-text-xs ap-font-medium ap-text-gray-500">User ID</p>
            <p className="ap-mt-0.5 ap-text-sm ap-font-mono ap-text-gray-500">#{user.id}</p>
          </div>
        </div>
      </div>

      {/* Enabled modules */}
      {enabledModules.length > 0 && (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-6 ap-shadow-sm">
          <h3 className="ap-mb-3 ap-text-sm ap-font-semibold ap-text-gray-900">Access & Modules</h3>
          <div className="ap-flex ap-flex-wrap ap-gap-2">
            {enabledModules.map(m => (
              <span key={m} className="ap-inline-flex ap-items-center ap-gap-1 ap-rounded-full ap-bg-brand-50 ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-text-brand-700">
                <svg className="ap-h-3 ap-w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Password change note */}
      <p className="ap-text-center ap-text-xs ap-text-gray-400">
        To change your password, use the password reset link on the login page.
      </p>
    </div>
  );
}
