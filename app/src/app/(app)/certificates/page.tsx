"use client";

import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, Badge, PageHeader } from "@/components/ui";

interface CertRecord {
  id: number;
  userId: number;
  expiresAt: string | null;
  issuedAt: string;
  fileUrl: string | null;
  certificateType: { name: string; description: string | null; validityMonths: number | null } | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function expiryVariant(expiresAt: string | null): "success" | "warning" | "error" | "neutral" {
  if (!expiresAt) return "neutral";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff < 0) return "error";
  if (diff < 30 * 24 * 60 * 60 * 1000) return "warning";
  return "success";
}

export default function CertificatesPage() {
  const { data, loading, error } = useApi<{ records: CertRecord[] }>("/api/certificates?section=records");

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load certificates" description="Please refresh." />;

  const records = data.records ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Certificates" description="Your active certifications and expiry dates." />

      {records.length === 0 ? (
        <EmptyState title="No certificates on file" description="Contact your admin to upload certifications." />
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">Certificate</th>
                <th className="px-5 py-3">Issued</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{r.certificateType?.name ?? "Unknown"}</td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(r.issuedAt)}</td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(r.expiresAt)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={expiryVariant(r.expiresAt)}>
                      {!r.expiresAt ? "No expiry" : new Date(r.expiresAt) < new Date() ? "Expired" : "Active"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {r.fileUrl
                      ? <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-xs">View</a>
                      : <span className="text-gray-400 text-xs">—</span>}
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
