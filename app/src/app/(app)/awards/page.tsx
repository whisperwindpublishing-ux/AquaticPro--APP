"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader } from "@/components/ui";

interface Nomination {
  id: number;
  nomineeId: number;
  nominatorId: number;
  reason: string | null;
  categoryId: number;
  periodId: number;
  archived: boolean;
}
interface Period   { id: number; name: string; startDate: string; endDate: string; }
interface Category { id: number; name: string; description: string | null; }

export default function AwardsPage() {
  const { data: periodsData }  = useApi<{ periods: Period[] }>("/api/awesome-awards?section=periods");
  const { data: catData }      = useApi<{ categories: Category[] }>("/api/awesome-awards?section=categories");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const { data: nomData, loading, refetch } = useApi<{ nominations: Nomination[] }>(
    `/api/awesome-awards?section=nominations${periodId ? `&periodId=${periodId}` : ""}`
  );

  const [showForm, setShowForm]       = useState(false);
  const [nomineeId, setNomineeId]     = useState("");
  const [categoryId, setCategoryId]   = useState("");
  const [reason, setReason]           = useState("");
  const [saving, setSaving]           = useState(false);

  const periods    = periodsData?.periods ?? [];
  const categories = catData?.categories ?? [];
  const nominations = nomData?.nominations ?? [];

  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  async function nominate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/api/awesome-awards", {
        action: "nominate",
        periodId: periodId ?? periods[0]?.id,
        categoryId: Number(categoryId),
        nomineeId: Number(nomineeId),
        message: reason,
      });
      setShowForm(false); setNomineeId(""); setCategoryId(""); setReason("");
      refetch();
    } finally { setSaving(false); }
  }

  async function vote(nominationId: number) {
    await apiClient.post("/api/awesome-awards", { action: "vote", nominationId });
    refetch();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Awesome Awards" description="Nominate and celebrate outstanding team members.">
        <Button size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Nominate"}</Button>
      </PageHeader>

      {periods.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setPeriodId(null)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${ periodId === null ? "bg-brand-500 text-white border-brand-500" : "border-gray-200 text-gray-600 hover:border-brand-400" }`}>All</button>
          {periods.map(p => (
            <button key={p.id} onClick={() => setPeriodId(p.id)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${ periodId === p.id ? "bg-brand-500 text-white border-brand-500" : "border-gray-200 text-gray-600 hover:border-brand-400" }`}>{p.name}</button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">New Nomination</h2>
          <form onSubmit={nominate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nominee User ID</label>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" type="number" value={nomineeId} onChange={e => setNomineeId(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Reason</label>
              <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm h-20 resize-none" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Nominate"}</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? <FullPageSpinner /> : nominations.length === 0 ? (
        <EmptyState title="No nominations yet" description="Be the first to nominate someone!" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {nominations.map(n => (
            <div key={n.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Nominee #{n.nomineeId}</span>
                <Badge variant="info">{catMap[n.categoryId] ?? `Category #${n.categoryId}`}</Badge>
              </div>
              {n.reason && <p className="text-sm text-gray-700 line-clamp-3">{n.reason}</p>}
              <button onClick={() => vote(n.id)} className="mt-auto self-start text-xs font-medium text-brand-600 hover:underline">👍 Vote</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
