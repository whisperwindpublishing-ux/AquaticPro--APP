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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">New Daily Log</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Log Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tags <span className="text-gray-400">(optional, comma-separated)</span></label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="lifeguard, inservice"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {err && <p className="text-xs text-error-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Daily Logs"
        subtitle="Track and review daily activity logs"
        right={
          <Button onClick={() => setShowModal(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Log
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFilter(""); setPage(1); }}>
            Clear date
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tags</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{fmtDate(log.logDate)}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {log.tags
                      ? log.tags.split(",").map((t) => (
                          <span key={t} className="mr-1 inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t.trim()}</span>
                        ))
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{fmtDate(log.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="rounded p-1 text-gray-300 hover:bg-error-50 hover:text-error-500"
                      title="Delete log"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}  ({data?.total ?? 0} total)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showModal && <NewLogModal onClose={() => setShowModal(false)} onCreated={refetch} />}
    </div>
  );
}
