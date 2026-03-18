"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, StatCard, PageHeader, Button, Badge } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminStats { userCount: number; newHireCount: number; openTaskCount: number; logCount: number; }
interface Settings { settings: Record<string, string> }
interface ActionButton { id: number; title: string; url: string; color: string; thumbnailUrl: string | null; sortOrder: number; }
interface ActionButtonsData { buttons: ActionButton[] }

// ─── Icons ───────────────────────────────────────────────────────────────────

function PeopleIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function ClipIcon()   { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>; }
function TaskIcon()   { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" /></svg>; }
function LogIcon()    { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }

const ADMIN_LINKS = [
  { href: "/admin/roles",      label: "Job Roles & Permissions", desc: "Create roles, set tiers, configure module access per role", icon: "🛡️" },
  { href: "/admin/daily-logs", label: "Daily Logs Settings",     desc: "Manage time slots for daily log entries",                   icon: "📋" },
  { href: "/new-hires",        label: "New Hire Manager",        desc: "Review and process applicants",                             icon: "👤" },
  { href: "/email-composer",   label: "Email Composer",          desc: "Send announcements to staff",                               icon: "✉️" },
  { href: "/foia-export",      label: "FOIA Export",             desc: "Download compliance data extracts",                         icon: "📄" },
  { href: "/lms-auto-assign",  label: "LMS Auto-Assign",         desc: "Configure automatic course assignments",                    icon: "🏖️" },
] as const;

const KNOWN_SETTINGS = [
  {
    key: "aquaticpro_is_accepting",
    label: "Accept New Applications",
    description: "When disabled, the public /apply form will reject all submissions.",
    type: "toggle" as const,
  },
  {
    key: "aquaticpro_app_admin_tier",
    label: "Admin Tier Threshold",
    description: "Minimum job role tier required to have admin access (1–6).",
    type: "number" as const,
  },
];

const BUTTON_COLORS = ["blue","green","purple","amber","red","gray","indigo","pink"] as const;
type Tab = "overview" | "settings" | "buttons";

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data, loading, refetch } = useApi<Settings>("/api/admin/settings");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, string> | null>(null);

  const settings = localSettings ?? data?.settings ?? {};

  function set(key: string, value: string) {
    setLocalSettings({ ...settings, [key]: value });
    setSaved(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/api/admin/settings", settings);
      setSaved(true);
      refetch?.();
    } finally { setSaving(false); }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-5">
      {KNOWN_SETTINGS.map(({ key, label, description, type }) => (
        <div key={key} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{description}</p>
            </div>
            {type === "toggle" ? (
              <button
                type="button"
                role="switch"
                aria-checked={settings[key] !== "false" && settings[key] !== "0"}
                onClick={() => set(key, settings[key] === "false" || settings[key] === "0" ? "true" : "false")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  settings[key] === "false" || settings[key] === "0" ? "bg-gray-200" : "bg-brand-500"
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings[key] === "false" || settings[key] === "0" ? "translate-x-0" : "translate-x-5"
                }`} />
              </button>
            ) : (
              <input
                type="number"
                min={1} max={6}
                value={settings[key] ?? "6"}
                onChange={(e) => set(key, e.target.value)}
                className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-brand-500 focus:outline-none"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Save Settings</Button>
        {saved && <span className="text-sm text-success-600">✓ Saved</span>}
      </div>
    </form>
  );
}

// ─── Action Buttons Tab ───────────────────────────────────────────────────────

function ActionButtonsTab() {
  const { data, loading, refetch } = useApi<ActionButtonsData>("/api/admin/action-buttons");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", color: "blue", sortOrder: "0" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/api/admin/action-buttons", { ...form, sortOrder: parseInt(form.sortOrder) });
      setForm({ title: "", url: "", color: "blue", sortOrder: "0" });
      setAdding(false);
      refetch?.();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this action button?")) return;
    await apiClient.delete(`/api/admin/action-buttons?id=${id}`);
    refetch?.();
  }

  if (loading) return <FullPageSpinner />;
  const buttons = data?.buttons ?? [];

  const inputClass = "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

  return (
    <div className="max-w-2xl space-y-4">
      {buttons.length === 0 && !adding && (
        <EmptyState
          title="No action buttons yet"
          description="Add quick-access buttons that appear on every user's dashboard."
          action={<Button onClick={() => setAdding(true)}>Add Button</Button>}
        />
      )}

      {buttons.map((btn) => (
        <div key={btn.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 shrink-0 rounded-lg bg-${btn.color}-100 flex items-center justify-center text-${btn.color}-600 font-bold text-sm`}>
              {btn.title.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{btn.title}</p>
              <p className="text-xs text-gray-500 truncate max-w-xs">{btn.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{btn.color}</Badge>
            <button
              onClick={() => handleDelete(btn.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-500 transition-colors"
              title="Delete"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {buttons.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)}>+ Add Button</Button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="rounded-xl border border-brand-100 bg-brand-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">New Action Button</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Label (e.g. Schedules)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass + " col-span-2"}
            />
            <input
              required
              placeholder="URL (e.g. https://…)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className={inputClass + " col-span-2"}
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputClass + " w-full"}>
                {BUTTON_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className={inputClass + " w-full"}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>Add</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: permData, loading: permLoading } = usePermissions();
  const permissions = permData?.permissions;
  const { data, loading } = useApi<AdminStats>("/api/dashboard");
  const [tab, setTab] = useState<Tab>("overview");

  if (permLoading || loading) return <FullPageSpinner />;
  if (!permissions?.isAdmin) return <EmptyState title="Access denied" description="Admin access required." />;

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "settings", label: "App Settings" },
    { id: "buttons", label: "Action Buttons" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Admin Panel" description="Platform management and oversight." />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 mb-[-1px] ${
              tab === id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          {data && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Users"      value={data.userCount ?? 0}     icon={<PeopleIcon />} color="blue"   />
              <StatCard label="New Hires"  value={data.newHireCount ?? 0}  icon={<ClipIcon />}  color="amber"  />
              <StatCard label="Open Tasks" value={data.openTaskCount ?? 0} icon={<TaskIcon />}  color="green"  />
              <StatCard label="Daily Logs" value={data.logCount ?? 0}      icon={<LogIcon />}   color="purple" />
            </div>
          )}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Admin Tools</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ADMIN_LINKS.map(({ href, label, desc, icon }) => (
                <Link key={href} href={href} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: App Settings */}
      {tab === "settings" && <SettingsTab />}

      {/* Tab: Action Buttons */}
      {tab === "buttons" && <ActionButtonsTab />}
    </div>
  );
}

