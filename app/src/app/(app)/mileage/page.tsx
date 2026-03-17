"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Button, PageHeader } from "@/components/ui";

interface MileageEntry {
  id: number;
  tripDate: string;
  fromLocation: string | null;
  toLocation: string | null;
  miles: number;
  reimbursementAmount: number | null;
  purpose: string | null;
  status: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export default function MileagePage() {
  const { data, loading, error, refetch } = useApi<{ entries: MileageEntry[] }>("/api/mileage?section=entries");
  const [showForm, setShowForm] = useState(false);
  const [tripDate, setTripDate]   = useState(new Date().toISOString().slice(0, 10));
  const [miles, setMiles]         = useState("");
  const [purpose, setPurpose]     = useState("");
  const [saving, setSaving]       = useState(false);
  const inputCls = "ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/api/mileage", { tripDate, miles: Number(miles), purpose: purpose || null });
      setShowForm(false); setMiles(""); setPurpose("");
      refetch();
    } finally { setSaving(false); }
  }

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load mileage" description="Please refresh." />;

  const entries = data.entries ?? [];
  const totalMiles = entries.reduce((s, e) => s + e.miles, 0);
  const totalReimb = entries.reduce((s, e) => s + (e.reimbursementAmount ?? 0), 0);

  return (
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-4">
      <PageHeader title="Mileage Reimbursement" description="Log and track your travel reimbursements.">
        <Button size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Log Trip"}</Button>
      </PageHeader>

      {showForm && (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
          <h2 className="ap-mb-4 ap-text-sm ap-font-semibold ap-text-gray-900">New Mileage Entry</h2>
          <form onSubmit={submit} className="ap-grid ap-gap-4 sm:ap-grid-cols-3">
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Trip Date</label>
              <input type="date" className={inputCls} value={tripDate} onChange={e => setTripDate(e.target.value)} required />
            </div>
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Miles</label>
              <input type="number" step="0.1" className={inputCls} value={miles} onChange={e => setMiles(e.target.value)} required placeholder="12.5" />
            </div>
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Purpose</label>
              <input type="text" className={inputCls} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Pool visit" />
            </div>
            <div className="sm:ap-col-span-3 ap-flex ap-justify-end ap-gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="ap-grid ap-grid-cols-2 ap-gap-4">
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm ap-text-center">
          <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{totalMiles.toFixed(1)}</p>
          <p className="ap-text-xs ap-text-gray-500">Total Miles</p>
        </div>
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm ap-text-center">
          <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{fmtMoney(totalReimb)}</p>
          <p className="ap-text-xs ap-text-gray-500">Total Reimbursed</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Log your first trip above." />
      ) : (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
          <table className="ap-w-full ap-text-sm">
            <thead>
              <tr className="ap-border-b ap-border-gray-100 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">
                <th className="ap-px-5 ap-py-3">Date</th>
                <th className="ap-px-5 ap-py-3">Miles</th>
                <th className="ap-px-5 ap-py-3">Purpose</th>
                <th className="ap-px-5 ap-py-3">Reimbursement</th>
              </tr>
            </thead>
            <tbody className="ap-divide-y ap-divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:ap-bg-gray-50">
                  <td className="ap-px-5 ap-py-3 ap-text-gray-800">{fmtDate(e.tripDate)}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{e.miles}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600 ap-max-w-xs ap-truncate">{e.purpose ?? "—"}</td>
                  <td className="ap-px-5 ap-py-3 ap-font-medium ap-text-gray-800">{fmtMoney(e.reimbursementAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
