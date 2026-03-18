"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, StatCard, EmptyState, Badge, statusVariant } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  user: { id: number; displayName: string; avatarUrl: string | null; tier: number; isAdmin: boolean };
  modules: Record<string, boolean>;
  notifications: { id: number; message: string; contextUrl: string | null; time: string }[];
  recentLogs: { id: number; logDate: string; status: string; createdAt: string }[];
  openTaskCount: number;
  actionButtons: { id: number; title: string; url: string; color: string | null; thumbnailUrl: string | null }[];
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function LogIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${salutation}, ${name.split(" ")[0]}!`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({ btn }: { btn: DashboardData["actionButtons"][0] }) {
  const isExternal = btn.url.startsWith("http");
  const cls = "flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md";
  const inner = (
    <>
      {btn.thumbnailUrl ? (
        <img src={btn.thumbnailUrl} alt={btn.title} className="h-10 w-10 rounded-lg object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-600">
          {btn.title.charAt(0)}
        </div>
      )}
      <span className="text-xs font-medium text-gray-700">{btn.title}</span>
    </>
  );
  return isExternal
    ? <a href={btn.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={btn.url} className={cls}>{inner}</Link>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, loading, error } = useApi<DashboardData>("/api/dashboard");

  if (loading) return <FullPageSpinner />;
  if (error || !data)
    return <EmptyState title="Could not load dashboard" description="An unexpected error occurred. Please refresh." />;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Welcome */}
      <div className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-5 text-white">
        <h1 className="text-2xl font-bold">{greeting(data.user.displayName)}</h1>
        <p className="mt-0.5 text-sm text-brand-100">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Unread Notifications" value={data.notifications.length} sub="latest activity" icon={<BellIcon />} color="blue" />
        <StatCard label="Open Tasks"           value={data.openTaskCount}          sub="assigned to you" icon={<TaskIcon />} color="amber" />
        <StatCard label="Recent Logs"          value={data.recentLogs.length}      sub="last 5 entries"  icon={<LogIcon />}  color="green" />
      </div>

      {/* Action buttons */}
      {data.actionButtons.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.actionButtons.map((btn) => <ActionButton key={btn.id} btn={btn} />)}
          </div>
        </div>
      )}

      {/* Activity columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent logs */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Daily Logs</h2>
            <Link href="/daily-logs" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
          </div>
          {data.recentLogs.length === 0 ? (
            <EmptyState title="No logs yet" description="Your recent daily logs will appear here." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.recentLogs.map((log) => (
                <li key={log.id}>
                  <Link href={`/daily-logs?id=${log.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{fmtDate(log.logDate)}</span>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {data.notifications.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error-100 text-[10px] font-bold text-error-700">
                {data.notifications.length}
              </span>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <EmptyState title="You're all caught up!" description="No unread notifications." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.notifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <div className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0">
                      {n.contextUrl
                        ? <Link href={n.contextUrl} className="text-sm text-gray-700 line-clamp-2 hover:underline">{n.message}</Link>
                        : <p className="text-sm text-gray-700 line-clamp-2">{n.message}</p>
                      }
                      <p className="text-xs text-gray-400">{fmtRelative(n.time)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
