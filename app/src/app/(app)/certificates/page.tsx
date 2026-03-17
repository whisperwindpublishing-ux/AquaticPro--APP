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
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-4">
      <PageHeader title="Certificates" description="Your active certifications and expiry dates." />

      {records.length === 0 ? (
        <EmptyState title="No certificates on file" description="Contact your admin to upload certifications." />
      ) : (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
          <table className="ap-w-full ap-text-sm">
            <thead>
              <tr className="ap-border-b ap-border-gray-100 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">
                <th className="ap-px-5 ap-py-3">Certificate</th>
                <th className="ap-px-5 ap-py-3">Issued</th>
                <th className="ap-px-5 ap-py-3">Expires</th>
                <th className="ap-px-5 ap-py-3">Status</th>
                <th className="ap-px-5 ap-py-3">File</th>
              </tr>
            </thead>
            <tbody className="ap-divide-y ap-divide-gray-50">
              {records.map(r => (
                <tr key={r.id} className="hover:ap-bg-gray-50">
                  <td className="ap-px-5 ap-py-3 ap-font-medium ap-text-gray-800">{r.certificateType?.name ?? "Unknown"}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{fmtDate(r.issuedAt)}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{fmtDate(r.expiresAt)}</td>
                  <td className="ap-px-5 ap-py-3">
                    <Badge variant={expiryVariant(r.expiresAt)}>
                      {!r.expiresAt ? "No expiry" : new Date(r.expiresAt) < new Date() ? "Expired" : "Active"}
                    </Badge>
                  </td>
                  <td className="ap-px-5 ap-py-3">
                    {r.fileUrl
                      ? <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="ap-text-brand-600 hover:ap-underline ap-text-xs">View</a>
                      : <span className="ap-text-gray-400 ap-text-xs">—</span>}
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
