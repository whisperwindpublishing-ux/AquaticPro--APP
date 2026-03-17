"use client";

import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, Badge, PageHeader } from "@/components/ui";

interface JobRole   { id: number; name: string; tier: number; description: string | null; }
interface Assignment { id: number; jobRoleId: number; isPrimary: boolean; assignedDate: string; }
interface Criterion { id: number; jobRoleId: number; title: string; description: string | null; sortOrder: number; }
interface Progress  { id: number; criterionId: number; status: string; evidenceUrl: string | null; }

interface PGData {
  roles:       JobRole[];
  assignments: Assignment[];
  criteria:    Criterion[];
  progress:    Progress[];
}

const TIER_LABELS: Record<number, string> = { 1: "Entry", 2: "Mid", 3: "Senior", 4: "Lead", 5: "Director" };

function progressVariant(status: string): "success" | "info" | "default" {
  if (status === "approved") return "success";
  if (status === "submitted") return "info";
  return "default";
}

export default function CareerPage() {
  const { data, loading, error } = useApi<PGData>("/api/professional-growth?section=all");

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load career data" description="Please refresh." />;

  const progressMap = Object.fromEntries(data.progress.map(p => [p.criterionId, p]));
  const assignedRoleIds = new Set(data.assignments.map(a => a.jobRoleId));
  const assignedRoles   = data.roles.filter(r => assignedRoleIds.has(r.id));
  const primaryAssignment = data.assignments.find(a => a.isPrimary);
  const primaryRole = primaryAssignment ? data.roles.find(r => r.id === primaryAssignment.jobRoleId) : null;

  return (
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-6">
      <PageHeader title="Career Development" description="Your job roles, promotion criteria, and progress." />

      {/* Current Role */}
      {primaryRole && (
        <div className="ap-rounded-xl ap-border ap-border-brand-200 ap-bg-brand-50 ap-p-5">
          <p className="ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-brand-400">Current Role</p>
          <h2 className="ap-mt-1 ap-text-xl ap-font-bold ap-text-brand-700">{primaryRole.name}</h2>
          <Badge variant="info">Tier {primaryRole.tier} — {TIER_LABELS[primaryRole.tier] ?? "Staff"}</Badge>
        </div>
      )}

      {/* All assignments */}
      {assignedRoles.length > 0 && (
        <div>
          <h3 className="ap-mb-2 ap-text-sm ap-font-semibold ap-text-gray-700">Assigned Roles</h3>
          <div className="ap-flex ap-flex-wrap ap-gap-2">
            {assignedRoles.map(r => (
              <div key={r.id} className="ap-flex ap-items-center ap-gap-2 ap-rounded-lg ap-border ap-border-gray-200 ap-bg-white ap-px-3 ap-py-2">
                <span className="ap-text-sm ap-font-medium ap-text-gray-800">{r.name}</span>
                <Badge variant="default">T{r.tier}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotion criteria */}
      {data.criteria.length > 0 && (
        <div>
          <h3 className="ap-mb-3 ap-text-sm ap-font-semibold ap-text-gray-700">Promotion Criteria</h3>
          <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-divide-y ap-divide-gray-50 ap-shadow-sm">
            {data.criteria.map(c => {
              const prog = progressMap[c.id];
              return (
                <div key={c.id} className="ap-flex ap-items-center ap-gap-3 ap-px-5 ap-py-4">
                  <div className="ap-flex-1 ap-min-w-0">
                    <p className="ap-text-sm ap-font-medium ap-text-gray-900">{c.title}</p>
                    {c.description && <p className="ap-text-xs ap-text-gray-500 ap-truncate">{c.description}</p>}
                  </div>
                  <Badge variant={prog ? progressVariant(prog.status) : "default"}>
                    {prog?.status ?? "Not started"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.criteria.length === 0 && assignedRoles.length === 0 && (
        <EmptyState title="No career data" description="Contact your admin to set up your job role and criteria." />
      )}
    </div>
  );
}
