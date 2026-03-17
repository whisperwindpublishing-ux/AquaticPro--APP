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

function PeopleIcon() { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function ClipIcon()   { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>; }
function TaskIcon()   { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" /></svg>; }
function LogIcon()    { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }

const ADMIN_LINKS = [
  { href: "/new-hires",      label: "New Hire Manager",    desc: "Review and process applicants",          icon: "👤" },
  { href: "/email-composer", label: "Email Composer",      desc: "Send announcements to staff",            icon: "✉️" },
  { href: "/foia-export",    label: "FOIA Export",         desc: "Download compliance data extracts",      icon: "📄" },
  { href: "/career",         label: "Career / Roles",      desc: "Manage job roles and assignments",       icon: "📈" },
  { href: "/lms-auto-assign",label: "LMS Auto-Assign",     desc: "Configure automatic course assignments", icon: "🏖️" },
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
    <form onSubmit={handleSave} className="ap-max-w-lg ap-space-y-5">
      {KNOWN_SETTINGS.map(({ key, label, description, type }) => (
        <div key={key} className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
          <div className="ap-flex ap-items-start ap-justify-between ap-gap-4">
            <div className="ap-flex-1">
              <p className="ap-text-sm ap-font-semibold ap-text-gray-900">{label}</p>
              <p className="ap-mt-0.5 ap-text-xs ap-text-gray-500">{description}</p>
            </div>
            {type === "toggle" ? (
              <button
                type="button"
                role="switch"
                aria-checked={settings[key] !== "false" && settings[key] !== "0"}
                onClick={() => set(key, settings[key] === "false" || settings[key] === "0" ? "true" : "false")}
                className={`ap-relative ap-inline-flex ap-h-6 ap-w-11 ap-shrink-0 ap-cursor-pointer ap-rounded-full ap-border-2 ap-border-transparent ap-transition-colors ${
                  settings[key] === "false" || settings[key] === "0" ? "ap-bg-gray-200" : "ap-bg-brand-500"
                }`}
              >
                <span className={`ap-pointer-events-none ap-inline-block ap-h-5 ap-w-5 ap-rounded-full ap-bg-white ap-shadow ap-transition-transform ${
                  settings[key] === "false" || settings[key] === "0" ? "ap-translate-x-0" : "ap-translate-x-5"
                }`} />
              </button>
            ) : (
              <input
                type="number"
                min={1} max={6}
                value={settings[key] ?? "6"}
                onChange={(e) => set(key, e.target.value)}
                className="ap-w-20 ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-1.5 ap-text-sm ap-text-center focus:ap-border-brand-500 focus:ap-outline-none"
              />
            )}
          </div>
        </div>
      ))}

      <div className="ap-flex ap-items-center ap-gap-3">
        <Button type="submit" loading={saving}>Save Settings</Button>
        {saved && <span className="ap-text-sm ap-text-success-600">✓ Saved</span>}
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

  const inputClass = "ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none";

  return (
    <div className="ap-max-w-2xl ap-space-y-4">
      {buttons.length === 0 && !adding && (
        <EmptyState
          title="No action buttons yet"
          description="Add quick-access buttons that appear on every user's dashboard."
          action={<Button onClick={() => setAdding(true)}>Add Button</Button>}
        />
      )}

      {buttons.map((btn) => (
        <div key={btn.id} className="ap-flex ap-items-center ap-justify-between ap-gap-4 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm">
          <div className="ap-flex ap-items-center ap-gap-3">
            <div className={`ap-h-8 ap-w-8 ap-shrink-0 ap-rounded-lg ap-bg-${btn.color}-100 ap-flex ap-items-center ap-justify-center ap-text-${btn.color}-600 ap-font-bold ap-text-sm`}>
              {btn.title.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="ap-text-sm ap-font-medium ap-text-gray-900">{btn.title}</p>
              <p className="ap-text-xs ap-text-gray-500 ap-truncate ap-max-w-xs">{btn.url}</p>
            </div>
          </div>
          <div className="ap-flex ap-items-center ap-gap-2">
            <Badge variant="default">{btn.color}</Badge>
            <button
              onClick={() => handleDelete(btn.id)}
              className="ap-rounded-lg ap-p-1.5 ap-text-gray-400 hover:ap-bg-error-50 hover:ap-text-error-500 ap-transition-colors"
              title="Delete"
            >
              <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <form onSubmit={handleAdd} className="ap-rounded-xl ap-border ap-border-brand-100 ap-bg-brand-50 ap-p-5 ap-space-y-3">
          <p className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">New Action Button</p>
          <div className="ap-grid ap-grid-cols-2 ap-gap-3">
            <input
              required
              placeholder="Label (e.g. Schedules)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass + " ap-col-span-2"}
            />
            <input
              required
              placeholder="URL (e.g. https://…)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className={inputClass + " ap-col-span-2"}
            />
            <div>
              <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-1">Color</label>
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputClass + " ap-w-full"}>
                {BUTTON_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className={inputClass + " ap-w-full"}
              />
            </div>
          </div>
          <div className="ap-flex ap-gap-2">
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
    <div className="ap-mx-auto ap-max-w-5xl ap-space-y-6">
      <PageHeader title="Admin Panel" description="Platform management and oversight." />

      {/* Tab bar */}
      <div className="ap-flex ap-gap-1 ap-border-b ap-border-gray-200">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`ap-px-4 ap-py-2.5 ap-text-sm ap-font-medium ap-transition-colors ap-border-b-2 ap-mb-[-1px] ${
              tab === id
                ? "ap-border-brand-500 ap-text-brand-600"
                : "ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="ap-space-y-6">
          {data && (
            <div className="ap-grid ap-grid-cols-2 ap-gap-4 lg:ap-grid-cols-4">
              <StatCard label="Users"      value={data.userCount ?? 0}     icon={<PeopleIcon />} color="blue"   />
              <StatCard label="New Hires"  value={data.newHireCount ?? 0}  icon={<ClipIcon />}  color="amber"  />
              <StatCard label="Open Tasks" value={data.openTaskCount ?? 0} icon={<TaskIcon />}  color="green"  />
              <StatCard label="Daily Logs" value={data.logCount ?? 0}      icon={<LogIcon />}   color="purple" />
            </div>
          )}
          <div>
            <h2 className="ap-mb-3 ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">Admin Tools</h2>
            <div className="ap-grid ap-gap-3 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
              {ADMIN_LINKS.map(({ href, label, desc, icon }) => (
                <Link key={href} href={href} className="ap-flex ap-items-start ap-gap-3 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm ap-transition-shadow hover:ap-shadow-md">
                  <span className="ap-text-2xl">{icon}</span>
                  <div>
                    <p className="ap-text-sm ap-font-semibold ap-text-gray-900">{label}</p>
                    <p className="ap-text-xs ap-text-gray-500">{desc}</p>
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

