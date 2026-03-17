"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient, ApiError } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader, statusVariant } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyLog {
  id: number;
  logDate: string;
  status: string;
  createdAt: string;
  authorId: number;
  locationId: number | null;
  tags: string | null;
}

interface LogsResponse {
  logs: DailyLog[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// ─── New Log Modal ────────────────────────────────────────────────────────────

function NewLogModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await apiClient.post("/api/daily-logs", { logDate: date, tags: tags || null, status: "publish" });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? JSON.stringify(e.data) : "Failed to create log.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-bg-gray-900/50">
      <div className="ap-w-full ap-max-w-md ap-rounded-2xl ap-bg-white ap-p-6 ap-shadow-xl">
        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">New Daily Log</h2>
        <form onSubmit={handleSubmit} className="ap-mt-4 ap-space-y-4">
          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Log Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="ap-mt-1 ap-block ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-400 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-brand-400"
            />
          </div>
          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Tags <span className="ap-text-gray-400">(optional, comma-separated)</span></label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="lifeguard, inservice"
              className="ap-mt-1 ap-block ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-400 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-brand-400"
            />
          </div>
          {err && <p className="ap-text-xs ap-text-error-600">{err}</p>}
          <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create Log</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DailyLogsPage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const params: Record<string, string> = { page: String(page), limit: "25" };
  if (dateFilter) params.date = dateFilter;

  const { data, loading, error, refetch } = useApi<LogsResponse>("/api/daily-logs", params);

  async function deleteLog(id: number) {
    if (!confirm("Move this log to trash?")) return;
    try {
      await apiClient.delete(`/api/daily-logs`, { id: String(id) });
      refetch();
    } catch { /* ignore */ }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="ap-mx-auto ap-max-w-4xl">
      <PageHeader
        title="Daily Logs"
        subtitle="Track and review daily activity logs"
        right={
          <Button onClick={() => setShowModal(true)}>
            <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Log
          </Button>
        }
      />

      {/* Filters */}
      <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          className="ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-1.5 ap-text-sm focus:ap-border-brand-400 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-brand-400"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFilter(""); setPage(1); }}>
            Clear date
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
        {loading ? (
          <FullPageSpinner />
        ) : error ? (
          <EmptyState title="Could not load logs" description={String(error.status === 403 ? "You don't have access to Daily Logs." : "An error occurred.")} />
        ) : !data?.logs.length ? (
          <EmptyState
            title="No logs found"
            description={dateFilter ? "No logs for the selected date." : "Create your first daily log above."}
            action={<Button onClick={() => setShowModal(true)}>New Log</Button>}
          />
        ) : (
          <table className="ap-w-full ap-text-sm">
            <thead>
              <tr className="ap-border-b ap-border-gray-100">
                <th className="ap-px-5 ap-py-3 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-500">Date</th>
                <th className="ap-px-5 ap-py-3 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-500">Tags</th>
                <th className="ap-px-5 ap-py-3 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-500">Status</th>
                <th className="ap-px-5 ap-py-3 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-500">Created</th>
                <th className="ap-w-10 ap-px-3 ap-py-3" />
              </tr>
            </thead>
            <tbody className="ap-divide-y ap-divide-gray-50">
              {data.logs.map((log) => (
                <tr key={log.id} className="hover:ap-bg-gray-50">
                  <td className="ap-px-5 ap-py-3 ap-font-medium ap-text-gray-900">{fmtDate(log.logDate)}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-500">
                    {log.tags
                      ? log.tags.split(",").map((t) => (
                          <span key={t} className="ap-mr-1 ap-inline-flex ap-rounded ap-bg-gray-100 ap-px-1.5 ap-py-0.5 ap-text-xs ap-text-gray-600">{t.trim()}</span>
                        ))
                      : <span className="ap-text-gray-300">—</span>}
                  </td>
                  <td className="ap-px-5 ap-py-3">
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-400">{fmtDate(log.createdAt)}</td>
                  <td className="ap-px-3 ap-py-3">
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="ap-rounded ap-p-1 ap-text-gray-300 hover:ap-bg-error-50 hover:ap-text-error-500"
                      title="Delete log"
                    >
                      <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ap-mt-4 ap-flex ap-items-center ap-justify-between ap-text-sm ap-text-gray-500">
          <span>Page {page} of {totalPages}  ({data?.total ?? 0} total)</span>
          <div className="ap-flex ap-gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showModal && <NewLogModal onClose={() => setShowModal(false)} onCreated={refetch} />}
    </div>
  );
}
