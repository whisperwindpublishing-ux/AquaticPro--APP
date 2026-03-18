"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader } from "@/components/ui";

interface NewHire {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  applicationDate: string | null;
  isArchived: boolean;
}

const STATUS_VARIANT: Record<string, "success" | "info" | "warning" | "neutral" | "error"> = {
  "approved": "success", "hired": "success",
  "pending":  "warning", "interview": "info",
  "rejected": "error",  "archived": "neutral",
};

export default function NewHiresPage() {
  const { data: permData } = usePermissions();
  const permissions = permData?.permissions;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, loading, error, refetch } = useApi<{ hires: NewHire[]; total: number }>(
    `/api/new-hires?search=${encodeURIComponent(search)}&status=${status}`
  );

  if (!permissions?.isAdmin) return <EmptyState title="Access denied" description="Admin access required." />;
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load new hires" description="Please refresh." />;

  const hires = data.hires ?? [];

  async function updateStatus(id: number, newStatus: string) {
    await apiClient.patch("/api/new-hires", { id, status: newStatus });
    refetch();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="New Hire Manager" description="Review and process applicants.">
        <span className="text-sm text-gray-500">{data.total} total</span>
      </PageHeader>

      <div className="flex gap-3">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {["pending", "interview", "approved", "hired", "rejected"].map(s =>
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          )}
        </select>
      </div>

      {hires.length === 0 ? (
        <EmptyState title="No applicants found" description="Try adjusting your search filters." />
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Applied</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hires.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{h.firstName} {h.lastName}</td>
                  <td className="px-5 py-3 text-gray-600">{h.email}</td>
                  <td className="px-5 py-3 text-gray-600">{h.applicationDate ? new Date(h.applicationDate).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3"><Badge variant={STATUS_VARIANT[h.status] ?? "neutral"}>{h.status}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {h.status !== "approved" && h.status !== "hired" && <Button size="sm" variant="ghost" onClick={() => updateStatus(h.id, "approved")}>Approve</Button>}
                      {h.status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => updateStatus(h.id, "rejected")}>Reject</Button>}
                      {(h.status === "approved" || h.status === "hired") && (
                        <a href={`/api/new-hires/${h.id}/loi`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="secondary">LOI</Button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
