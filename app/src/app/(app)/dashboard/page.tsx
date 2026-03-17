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
    <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function LogIcon() {
  return (
    <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
  const cls = "ap-flex ap-flex-col ap-items-center ap-gap-2 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-text-center ap-shadow-sm ap-transition-shadow hover:ap-shadow-md";
  const inner = (
    <>
      {btn.thumbnailUrl ? (
        <img src={btn.thumbnailUrl} alt={btn.title} className="ap-h-10 ap-w-10 ap-rounded-lg ap-object-cover" />
      ) : (
        <div className="ap-flex ap-h-10 ap-w-10 ap-items-center ap-justify-center ap-rounded-lg ap-bg-brand-100 ap-text-sm ap-font-bold ap-text-brand-600">
          {btn.title.charAt(0)}
        </div>
      )}
      <span className="ap-text-xs ap-font-medium ap-text-gray-700">{btn.title}</span>
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
    <div className="ap-mx-auto ap-max-w-5xl ap-space-y-6">
      {/* Welcome */}
      <div className="ap-rounded-xl ap-bg-gradient-to-r ap-from-brand-500 ap-to-brand-700 ap-px-6 ap-py-5 ap-text-white">
        <h1 className="ap-text-2xl ap-font-bold">{greeting(data.user.displayName)}</h1>
        <p className="ap-mt-0.5 ap-text-sm ap-text-brand-100">{today}</p>
      </div>

      {/* Stats */}
      <div className="ap-grid ap-grid-cols-1 ap-gap-4 sm:ap-grid-cols-3">
        <StatCard label="Unread Notifications" value={data.notifications.length} sub="latest activity" icon={<BellIcon />} color="blue" />
        <StatCard label="Open Tasks"           value={data.openTaskCount}          sub="assigned to you" icon={<TaskIcon />} color="amber" />
        <StatCard label="Recent Logs"          value={data.recentLogs.length}      sub="last 5 entries"  icon={<LogIcon />}  color="green" />
      </div>

      {/* Action buttons */}
      {data.actionButtons.length > 0 && (
        <div>
          <h2 className="ap-mb-3 ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">Quick Actions</h2>
          <div className="ap-grid ap-grid-cols-2 ap-gap-3 sm:ap-grid-cols-4 lg:ap-grid-cols-6">
            {data.actionButtons.map((btn) => <ActionButton key={btn.id} btn={btn} />)}
          </div>
        </div>
      )}

      {/* Activity columns */}
      <div className="ap-grid ap-grid-cols-1 ap-gap-4 lg:ap-grid-cols-2">
        {/* Recent logs */}
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
          <div className="ap-flex ap-items-center ap-justify-between ap-border-b ap-border-gray-100 ap-px-5 ap-py-4">
            <h2 className="ap-text-sm ap-font-semibold ap-text-gray-900">Recent Daily Logs</h2>
            <Link href="/daily-logs" className="ap-text-xs ap-font-medium ap-text-brand-600 hover:ap-underline">View all</Link>
          </div>
          {data.recentLogs.length === 0 ? (
            <EmptyState title="No logs yet" description="Your recent daily logs will appear here." />
          ) : (
            <ul className="ap-divide-y ap-divide-gray-50">
              {data.recentLogs.map((log) => (
                <li key={log.id}>
                  <Link href={`/daily-logs?id=${log.id}`} className="ap-flex ap-items-center ap-justify-between ap-px-5 ap-py-3 hover:ap-bg-gray-50">
                    <span className="ap-text-sm ap-text-gray-700">{fmtDate(log.logDate)}</span>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications */}
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
          <div className="ap-flex ap-items-center ap-justify-between ap-border-b ap-border-gray-100 ap-px-5 ap-py-4">
            <h2 className="ap-text-sm ap-font-semibold ap-text-gray-900">Notifications</h2>
            {data.notifications.length > 0 && (
              <span className="ap-flex ap-h-5 ap-w-5 ap-items-center ap-justify-center ap-rounded-full ap-bg-error-100 ap-text-[10px] ap-font-bold ap-text-error-700">
                {data.notifications.length}
              </span>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <EmptyState title="You're all caught up!" description="No unread notifications." />
          ) : (
            <ul className="ap-divide-y ap-divide-gray-50">
              {data.notifications.map((n) => (
                <li key={n.id} className="ap-px-5 ap-py-3">
                  <div className="ap-flex ap-gap-3">
                    <div className="ap-mt-1.5 ap-h-2 ap-w-2 ap-shrink-0 ap-rounded-full ap-bg-brand-500" />
                    <div className="ap-min-w-0">
                      {n.contextUrl
                        ? <Link href={n.contextUrl} className="ap-text-sm ap-text-gray-700 ap-line-clamp-2 hover:ap-underline">{n.message}</Link>
                        : <p className="ap-text-sm ap-text-gray-700 ap-line-clamp-2">{n.message}</p>
                      }
                      <p className="ap-text-xs ap-text-gray-400">{fmtRelative(n.time)}</p>
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
