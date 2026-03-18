"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { EmptyState, Button, PageHeader } from "@/components/ui";

type ExportType = "audit-log" | "users" | "new-hires";

const EXPORT_OPTIONS: { type: ExportType; label: string; description: string }[] = [
  { type: "audit-log", label: "Audit Log",  description: "All permission and login audit events" },
  { type: "users",     label: "Users",      description: "User roster with roles and metadata" },
  { type: "new-hires", label: "New Hires",  description: "Applicant records and status history" },
];

export default function FOIAExportPage() {
  const { data: permData } = usePermissions();
  const permissions = permData?.permissions;
  const [exportType, setExportType] = useState<ExportType>("audit-log");
  const [from, setFrom]   = useState("");
  const [to, setTo]       = useState("");
  const [loading, setLoading] = useState(false);

  if (!permissions?.isAdmin) return <EmptyState title="Access denied" description="Admin access required." />;

  async function doExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: exportType });
      if (from) params.set("from", from);
      if (to)   params.set("to",   to);
      const res  = await fetch(`/api/foia-export?${params}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${exportType}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="FOIA / Compliance Export" description="Download data extracts for compliance and public records requests." />

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Export Type</label>
          <div className="space-y-2">
            {EXPORT_OPTIONS.map(opt => (
              <label key={opt.type} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                exportType === opt.type ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value={opt.type}
                  checked={exportType === opt.type}
                  onChange={() => setExportType(opt.type)}
                  className="text-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">From Date <span className="text-gray-400">(optional)</span></label>
            <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">To Date <span className="text-gray-400">(optional)</span></label>
            <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={doExport} disabled={loading}>
            {loading ? "Exporting…" : "↓ Download JSON"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Exports are logged in the audit trail. Handle data in accordance with your organization’s privacy policy.
      </p>
    </div>
  );
}
