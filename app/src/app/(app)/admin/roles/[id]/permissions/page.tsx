"use client";

import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { FullPageSpinner, EmptyState, Button } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoleInfo { id: number; title: string; tier: number; }

interface PermissionsPayload {
  dailyLogs: Record<string, boolean> | null;
  taskdeck: Record<string, boolean> | null;
  lms: Record<string, boolean> | null;
  email: Record<string, boolean> | null;
  srm: Record<string, boolean> | null;
  awards: Record<string, boolean> | null;
  mileage: Record<string, boolean> | null;
  certs: Record<string, boolean> | null;
  lessonMgmt: Record<string, boolean> | null;
  scanAudit: Record<string, boolean> | null;
}

interface PermissionsData {
  role: RoleInfo;
  permissions: PermissionsPayload;
}

// ─── Module Definitions ───────────────────────────────────────────────────────
//
// Each module descriptor defines the key (matches API payload key), display label,
// and the set of individual permission fields for that module.

interface PermField { key: string; label: string; description?: string; }
interface Module { key: keyof PermissionsPayload; label: string; icon: string; fields: PermField[]; }

const MODULES: Module[] = [
  {
    key: "dailyLogs",
    label: "Daily Logs",
    icon: "📋",
    fields: [
      { key: "canView",        label: "View logs" },
      { key: "canCreate",      label: "Create logs" },
      { key: "canEdit",        label: "Edit own logs" },
      { key: "canDelete",      label: "Delete own logs" },
      { key: "canModerateAll", label: "Moderate all logs", description: "Can view, edit, and delete logs for any user" },
    ],
  },
  {
    key: "taskdeck",
    label: "TaskDeck",
    icon: "✅",
    fields: [
      { key: "canView",                  label: "View tasks" },
      { key: "canViewOnlyAssigned",      label: "View only assigned tasks", description: "Restricts view to cards assigned to this user" },
      { key: "canCreate",                label: "Create tasks" },
      { key: "canEdit",                  label: "Edit tasks" },
      { key: "canDelete",                label: "Delete tasks" },
      { key: "canModerateAll",           label: "Moderate all tasks" },
      { key: "canManagePrimaryDeck",     label: "Manage primary deck" },
      { key: "canManageAllPrimaryCards", label: "Manage all primary deck cards" },
      { key: "canCreatePublicDecks",     label: "Create public decks" },
    ],
  },
  {
    key: "lms",
    label: "Learning (LMS)",
    icon: "🎓",
    fields: [
      { key: "canViewCourses",    label: "View courses" },
      { key: "canViewLessons",    label: "View lessons" },
      { key: "canCreateCourses",  label: "Create courses" },
      { key: "canEditCourses",    label: "Edit courses" },
      { key: "canDeleteCourses",  label: "Delete courses" },
      { key: "canCreateLessons",  label: "Create lessons" },
      { key: "canEditLessons",    label: "Edit lessons" },
      { key: "canDeleteLessons",  label: "Delete lessons" },
      { key: "canManageHotspots", label: "Manage hotspots" },
      { key: "canManageExcalidraw", label: "Manage Excalidraw boards" },
      { key: "canModerateAll",    label: "Full LMS admin" },
    ],
  },
  {
    key: "awards",
    label: "Awesome Awards",
    icon: "🏆",
    fields: [
      { key: "canNominate",       label: "Submit nominations" },
      { key: "canVote",           label: "Vote on nominations" },
      { key: "canViewNominations",label: "View all nominations" },
      { key: "canViewWinners",    label: "View winners" },
      { key: "canViewArchives",   label: "View archived periods" },
      { key: "canApprove",        label: "Approve nominations" },
      { key: "canDirectAssign",   label: "Directly assign an award" },
      { key: "canManagePeriods",  label: "Manage award periods" },
      { key: "canArchive",        label: "Archive results" },
    ],
  },
  {
    key: "srm",
    label: "Seasonal Returns (SRM)",
    icon: "📅",
    fields: [
      { key: "srmViewOwnPay",      label: "View own pay info" },
      { key: "srmViewAllPay",      label: "View all employees' pay" },
      { key: "srmManagePayConfig", label: "Manage pay configuration" },
      { key: "srmSendInvites",     label: "Send return invites" },
      { key: "srmViewResponses",   label: "View employee responses" },
      { key: "srmManageStatus",    label: "Manage employee status" },
      { key: "srmManageTemplates", label: "Manage email templates" },
      { key: "srmViewRetention",   label: "View retention analytics" },
      { key: "srmBulkActions",     label: "Bulk actions on employees" },
    ],
  },
  {
    key: "mileage",
    label: "Mileage Reimbursement",
    icon: "🚗",
    fields: [
      { key: "canSubmit",  label: "Submit mileage claims" },
      { key: "canViewAll", label: "View all employees' claims" },
      { key: "canManage",  label: "Manage mileage settings & approve claims" },
    ],
  },
  {
    key: "email",
    label: "Email Composer",
    icon: "✉️",
    fields: [
      { key: "canSendEmail",       label: "Send emails" },
      { key: "canManageTemplates", label: "Manage email templates" },
      { key: "canViewHistory",     label: "View send history" },
    ],
  },
  {
    key: "certs",
    label: "Certificate Tracking",
    icon: "🎖️",
    fields: [
      { key: "canViewAll",       label: "View all certificates" },
      { key: "canEditRecords",   label: "Edit certificate records" },
      { key: "canManageTypes",   label: "Manage certificate types" },
      { key: "canApproveUploads",label: "Approve certificate uploads" },
      { key: "canBulkEdit",      label: "Bulk edit certificates" },
    ],
  },
  {
    key: "lessonMgmt",
    label: "Lesson Management",
    icon: "🖊️",
    fields: [
      { key: "canView",        label: "View lessons" },
      { key: "canCreate",      label: "Create lessons" },
      { key: "canEdit",        label: "Edit lessons" },
      { key: "canDelete",      label: "Delete lessons" },
      { key: "canModerateAll", label: "Moderate all lesson content" },
    ],
  },
  {
    key: "scanAudit",
    label: "Scan Audit",
    icon: "🔍",
    fields: [
      { key: "canView",        label: "View audit logs" },
      { key: "canCreate",      label: "Create audit entries" },
      { key: "canEdit",        label: "Edit audit entries" },
      { key: "canDelete",      label: "Delete audit entries" },
      { key: "canModerateAll", label: "Moderate all audit entries" },
    ],
  },
];

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-brand-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Module Section ───────────────────────────────────────────────────────────

interface ModuleSectionProps {
  mod: Module;
  values: Record<string, boolean>;
  onChange: (key: string, val: boolean) => void;
}

function ModuleSection({ mod, values, onChange }: ModuleSectionProps) {
  const enabledCount = mod.fields.filter((f) => values[f.key]).length;
  const allEnabled = enabledCount === mod.fields.length;

  function toggleAll() {
    const next = !allEnabled;
    mod.fields.forEach((f) => onChange(f.key, next));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Module header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{mod.icon}</span>
          <h3 className="font-semibold text-gray-900 text-sm">{mod.label}</h3>
          <span className="text-xs text-gray-400">({enabledCount}/{mod.fields.length} enabled)</span>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium"
        >
          {allEnabled ? "Disable all" : "Enable all"}
        </button>
      </div>

      {/* Permission fields */}
      <div className="divide-y divide-gray-50">
        {mod.fields.map((field) => (
          <div key={field.key} className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0 flex-1 pr-4">
              <p className="text-sm font-medium text-gray-900">{field.label}</p>
              {field.description && (
                <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
              )}
            </div>
            <Toggle
              checked={values[field.key] ?? false}
              onChange={(val) => onChange(field.key, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RolePermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: meData, loading: permLoading } = usePermissions();
  const myPerms = meData?.permissions;
  const { data, loading } = useApi<PermissionsData>(`/api/admin/roles/${id}/permissions`);

  // Local permission state — one object per module
  const [perms, setPerms] = useState<PermissionsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Seed local state once data arrives
  useEffect(() => {
    if (data?.permissions) {
      const raw = data.permissions;
      // Strip Prisma metadata fields, keep only boolean fields
      const clean = (obj: Record<string, unknown> | null): Record<string, boolean> => {
        if (!obj) return {};
        return Object.fromEntries(
          Object.entries(obj).filter(([k, v]) => typeof v === "boolean" && k !== "id" && k !== "jobRoleId")
        ) as Record<string, boolean>;
      };
      setPerms({
        dailyLogs: clean(raw.dailyLogs as Record<string, unknown>),
        taskdeck:  clean(raw.taskdeck as Record<string, unknown>),
        lms:       clean(raw.lms as Record<string, unknown>),
        email:     clean(raw.email as Record<string, unknown>),
        srm:       clean(raw.srm as Record<string, unknown>),
        awards:    clean(raw.awards as Record<string, unknown>),
        mileage:   clean(raw.mileage as Record<string, unknown>),
        certs:     clean(raw.certs as Record<string, unknown>),
        lessonMgmt:clean(raw.lessonMgmt as Record<string, unknown>),
        scanAudit: clean(raw.scanAudit as Record<string, unknown>),
      });
    }
  }, [data]);

  if (permLoading || loading) return <FullPageSpinner />;
  if (!myPerms?.isAdmin) {
    return <EmptyState title="Access Denied" description="Admin access required." />;
  }
  if (!data?.role || !perms) return <EmptyState title="Role not found" description="This role does not exist." />;

  const role = data.role;

  function setField(module: keyof PermissionsPayload, key: string, val: boolean) {
    setPerms((prev) => {
      if (!prev) return prev;
      return { ...prev, [module]: { ...(prev[module] ?? {}), [key]: val } };
    });
    setSaved(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!perms) return;
    setSaving(true);
    setSaveError("");
    try {
      await apiClient.put(`/api/admin/roles/${id}/permissions`, perms);
      setSaved(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save permissions.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Back breadcrumb */}
      <div>
        <Link
          href="/admin/roles"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← All Job Roles
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{role.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tier {role.tier} · Configure which parts of AquaticPro this role can access
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success-600 font-medium">✓ Saved</span>}
          {saveError && <span className="text-sm text-error-600">{saveError}</span>}
          <Button onClick={handleSave} loading={saving}>
            Save Permissions
          </Button>
        </div>
      </div>

      {/* Permission modules */}
      <form onSubmit={handleSave} className="space-y-4">
        {MODULES.map((mod) => (
          <ModuleSection
            key={mod.key}
            mod={mod}
            values={perms[mod.key] ?? {}}
            onChange={(key, val) => setField(mod.key, key, val)}
          />
        ))}

        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <span className="text-sm text-success-600 font-medium">✓ Saved</span>}
          {saveError && <span className="text-sm text-error-600">{saveError}</span>}
          <Button type="submit" loading={saving}>
            Save Permissions
          </Button>
        </div>
      </form>
    </div>
  );
}
