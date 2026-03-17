"use client";

import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, StatCard, PageHeader } from "@/components/ui";

interface AdminStats {
  userCount:     number;
  newHireCount:  number;
  openTaskCount: number;
  logCount:      number;
}

const ADMIN_LINKS = [
  { href: "/new-hires",     label: "New Hire Manager",  desc: "Review and process applicants",           icon: "👤" },
  { href: "/email-composer",label: "Email Composer",     desc: "Send announcements to staff",             icon: "✉️" },
  { href: "/foia-export",   label: "FOIA Export",       desc: "Download compliance data extracts",       icon: "📄" },
  { href: "/career",        label: "Career / Roles",    desc: "Manage job roles and assignments",         icon: "📈" },
  { href: "/lms-auto-assign",label: "LMS Auto-Assign",  desc: "Configure automatic course assignments",  icon: "🏖️" },
] as const;

function PeopleIcon()  { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function ClipIcon()    { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>; }
function TaskIcon()    { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" /></svg>; }
function LogIcon()     { return <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }

export default function AdminPage() {
  const { data: permData, loading: permLoading } = usePermissions();
  const permissions = permData?.permissions;
  const { data, loading } = useApi<AdminStats>("/api/dashboard");

  if (permLoading || loading) return <FullPageSpinner />;
  if (!permissions?.isAdmin) return <EmptyState title="Access denied" description="Admin access required." />;

  return (
    <div className="ap-mx-auto ap-max-w-5xl ap-space-y-6">
      <PageHeader title="Admin Panel" description="Platform management and oversight." />

      {/* Stats */}
      {data && (
        <div className="ap-grid ap-grid-cols-2 ap-gap-4 lg:ap-grid-cols-4">
          <StatCard label="Users"       value={data.userCount ?? 0}     icon={<PeopleIcon />} color="blue" />
          <StatCard label="New Hires"   value={data.newHireCount ?? 0}  icon={<ClipIcon />}  color="amber" />
          <StatCard label="Open Tasks"  value={data.openTaskCount ?? 0} icon={<TaskIcon />}  color="green" />
          <StatCard label="Daily Logs"  value={data.logCount ?? 0}      icon={<LogIcon />}   color="purple" />
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="ap-mb-3 ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">Admin Tools</h2>
        <div className="ap-grid ap-gap-3 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
          {ADMIN_LINKS.map(({ href, label, desc, icon }) => (
            <Link
              key={href}
              href={href}
              className="ap-flex ap-items-start ap-gap-3 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm ap-transition-shadow hover:ap-shadow-md"
            >
              <span className="ap-text-2xl">{icon}</span>
              <div>
                <p className="ap-text-sm ap-font-semibold ap-text-gray-900">{label}</p>
                <p className="ap-text-xs ap-text-gray-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
