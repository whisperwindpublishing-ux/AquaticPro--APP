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
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

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
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Mileage Reimbursement" description="Log and track your travel reimbursements.">
        <Button size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Log Trip"}</Button>
      </PageHeader>

      {showForm && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">New Mileage Entry</h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Trip Date</label>
              <input type="date" className={inputCls} value={tripDate} onChange={e => setTripDate(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Miles</label>
              <input type="number" step="0.1" className={inputCls} value={miles} onChange={e => setMiles(e.target.value)} required placeholder="12.5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Purpose</label>
              <input type="text" className={inputCls} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Pool visit" />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{totalMiles.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Total Miles</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(totalReimb)}</p>
          <p className="text-xs text-gray-500">Total Reimbursed</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Log your first trip above." />
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Miles</th>
                <th className="px-5 py-3">Purpose</th>
                <th className="px-5 py-3">Reimbursement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800">{fmtDate(e.tripDate)}</td>
                  <td className="px-5 py-3 text-gray-600">{e.miles}</td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{e.purpose ?? "—"}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{fmtMoney(e.reimbursementAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
