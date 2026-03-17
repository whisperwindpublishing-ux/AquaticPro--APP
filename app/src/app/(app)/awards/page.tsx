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
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-4">
      <PageHeader title="Awesome Awards" description="Nominate and celebrate outstanding team members.">
        <Button size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Nominate"}</Button>
      </PageHeader>

      {periods.length > 0 && (
        <div className="ap-flex ap-gap-2 ap-flex-wrap">
          <button onClick={() => setPeriodId(null)} className={`ap-rounded-full ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-border ap-transition-colors ${ periodId === null ? "ap-bg-brand-500 ap-text-white ap-border-brand-500" : "ap-border-gray-200 ap-text-gray-600 hover:ap-border-brand-400" }`}>All</button>
          {periods.map(p => (
            <button key={p.id} onClick={() => setPeriodId(p.id)} className={`ap-rounded-full ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-border ap-transition-colors ${ periodId === p.id ? "ap-bg-brand-500 ap-text-white ap-border-brand-500" : "ap-border-gray-200 ap-text-gray-600 hover:ap-border-brand-400" }`}>{p.name}</button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
          <h2 className="ap-mb-4 ap-text-sm ap-font-semibold ap-text-gray-900">New Nomination</h2>
          <form onSubmit={nominate} className="ap-grid ap-gap-4 sm:ap-grid-cols-2">
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Nominee User ID</label>
              <input className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm" type="number" value={nomineeId} onChange={e => setNomineeId(e.target.value)} required />
            </div>
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Category</label>
              <select className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:ap-col-span-2">
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Reason</label>
              <textarea className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm ap-h-20 ap-resize-none" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="sm:ap-col-span-2 ap-flex ap-justify-end ap-gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Nominate"}</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? <FullPageSpinner /> : nominations.length === 0 ? (
        <EmptyState title="No nominations yet" description="Be the first to nominate someone!" />
      ) : (
        <div className="ap-grid ap-gap-4 sm:ap-grid-cols-2">
          {nominations.map(n => (
            <div key={n.id} className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm ap-flex ap-flex-col ap-gap-2">
              <div className="ap-flex ap-items-center ap-justify-between">
                <span className="ap-text-xs ap-font-semibold ap-text-gray-500">Nominee #{n.nomineeId}</span>
                <Badge variant="info">Cat #{n.categoryId}</Badge>
              </div>
              {n.reason && <p className="ap-text-sm ap-text-gray-700 ap-line-clamp-3">{n.reason}</p>}
              <button onClick={() => vote(n.id)} className="ap-mt-auto ap-self-start ap-text-xs ap-font-medium ap-text-brand-600 hover:ap-underline">👍 Vote</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
