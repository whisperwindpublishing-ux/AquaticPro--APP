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

  const inputCls = "ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none";

  return (
    <div className="ap-mx-auto ap-max-w-2xl ap-space-y-6">
      <PageHeader title="FOIA / Compliance Export" description="Download data extracts for compliance and public records requests." />

      <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-6 ap-shadow-sm ap-space-y-5">
        <div>
          <label className="ap-mb-2 ap-block ap-text-sm ap-font-medium ap-text-gray-700">Export Type</label>
          <div className="ap-space-y-2">
            {EXPORT_OPTIONS.map(opt => (
              <label key={opt.type} className={`ap-flex ap-cursor-pointer ap-items-center ap-gap-3 ap-rounded-lg ap-border ap-p-3 ap-transition-colors ${
                exportType === opt.type ? "ap-border-brand-400 ap-bg-brand-50" : "ap-border-gray-200 hover:ap-border-gray-300"
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value={opt.type}
                  checked={exportType === opt.type}
                  onChange={() => setExportType(opt.type)}
                  className="ap-text-brand-500"
                />
                <div>
                  <p className="ap-text-sm ap-font-medium ap-text-gray-900">{opt.label}</p>
                  <p className="ap-text-xs ap-text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="ap-grid ap-grid-cols-2 ap-gap-4">
          <div>
            <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">From Date <span className="ap-text-gray-400">(optional)</span></label>
            <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">To Date <span className="ap-text-gray-400">(optional)</span></label>
            <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="ap-flex ap-justify-end">
          <Button onClick={doExport} disabled={loading}>
            {loading ? "Exporting…" : "↓ Download JSON"}
          </Button>
        </div>
      </div>

      <p className="ap-text-xs ap-text-gray-400 ap-text-center">
        Exports are logged in the audit trail. Handle data in accordance with your organization’s privacy policy.
      </p>
    </div>
  );
}
