"use client";

import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, Badge, PageHeader } from "@/components/ui";

interface Season { id: number; name: string; startDate: string; endDate: string; isActive: boolean; }
interface EmployeeSeason {
  id: number;
  userId: number;
  season: Season;
  returnStatus: string;
  payRate: number | null;
  hoursWorked: number | null;
  confirmedAt: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "info"> = {
  "Confirmed": "success",
  "Pending":   "warning",
  "Declined":  "neutral",
  "Invited":   "info",
};

export default function SeasonalReturnsPage() {
  const { data, loading, error } = useApi<{ seasons: Season[]; employeeSeasons: EmployeeSeason[] }>("/api/seasonal-returns?section=employee");

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load seasonal returns" description="Please refresh." />;

  const records = data.employeeSeasons ?? [];

  return (
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-4">
      <PageHeader title="Seasonal Returns" description="Your employment status across seasons." />

      {records.length === 0 ? (
        <EmptyState title="No seasonal records" description="Your seasonal employment history will appear here." />
      ) : (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
          <table className="ap-w-full ap-text-sm">
            <thead>
              <tr className="ap-border-b ap-border-gray-100 ap-text-left ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">
                <th className="ap-px-5 ap-py-3">Season</th>
                <th className="ap-px-5 ap-py-3">Period</th>
                <th className="ap-px-5 ap-py-3">Status</th>
                <th className="ap-px-5 ap-py-3">Hours</th>
                <th className="ap-px-5 ap-py-3">Confirmed</th>
              </tr>
            </thead>
            <tbody className="ap-divide-y ap-divide-gray-50">
              {records.map(r => (
                <tr key={r.id} className="hover:ap-bg-gray-50">
                  <td className="ap-px-5 ap-py-3 ap-font-medium ap-text-gray-800">{r.season.name}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{fmtDate(r.season.startDate)} – {fmtDate(r.season.endDate)}</td>
                  <td className="ap-px-5 ap-py-3"><Badge variant={STATUS_VARIANT[r.returnStatus] ?? "neutral"}>{r.returnStatus}</Badge></td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{r.hoursWorked ?? "—"}</td>
                  <td className="ap-px-5 ap-py-3 ap-text-gray-600">{r.confirmedAt ? new Date(r.confirmedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
