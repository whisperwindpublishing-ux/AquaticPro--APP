"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserPermissions } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import SignOutButton from "@/components/auth/SignOutButton";

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg className={`ap-h-5 ap-w-5 ap-shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const icons = {
  dashboard:   "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  logs:        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  taskdeck:    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  courses:     "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  lessons:     "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  whiteboard:  "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  mentorship:  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  goals:       "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  career:      "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  awards:      "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  certs:       "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  mileage:     "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  seasonal:    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  newHires:    "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  email:       "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  foia:        "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  admin:       "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

// ─── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "ap-flex ap-items-center ap-gap-3 ap-rounded-lg ap-px-3 ap-py-2 ap-text-sm ap-font-medium ap-transition-colors ap-duration-100",
        active
          ? "ap-bg-brand-50 ap-text-brand-700"
          : "ap-text-gray-600 hover:ap-bg-gray-50 hover:ap-text-gray-900",
      ].join(" ")}
    >
      <Icon d={icon} className={active ? "ap-text-brand-600" : "ap-text-gray-400"} />
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="ap-mb-1 ap-mt-4 ap-px-3 ap-text-[10px] ap-font-semibold ap-uppercase ap-tracking-widest ap-text-gray-400">
      {children}
    </p>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  user: SessionUser;
  permissions: UserPermissions;
}

export function Sidebar({ user, permissions: p }: SidebarProps) {
  const { modules, isAdmin } = p;

  return (
    <aside className="ap-flex ap-h-full ap-w-64 ap-flex-col ap-border-r ap-border-gray-100 ap-bg-white">
      {/* Brand */}
      <div className="ap-flex ap-h-16 ap-items-center ap-gap-2 ap-border-b ap-border-gray-100 ap-px-5">
          <div className="ap-h-8 ap-w-8 ap-rounded-lg ap-shrink-0" style={{ background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }} />
        <span className="ap-text-base ap-font-bold ap-text-gray-900">AquaticPro</span>
      </div>

      {/* Nav */}
      <nav className="ap-flex-1 ap-overflow-y-auto ap-px-3 ap-py-3">
        <SectionLabel>Core</SectionLabel>
        <NavItem href="/dashboard" icon={icons.dashboard} label="Dashboard" />
        {modules.dailyLogs      && <NavItem href="/daily-logs" icon={icons.logs}       label="Daily Logs" />}
        {modules.taskdeck       && <NavItem href="/taskdeck"   icon={icons.taskdeck}   label="Task Deck" />}

        {(modules.lms || modules.lessonManagement || modules.whiteboard) && (
          <>
            <SectionLabel>Learning</SectionLabel>
            {modules.lms              && <NavItem href="/courses"    icon={icons.courses}    label="Courses" />}
            {modules.lms              && <NavItem href="/lessons"    icon={icons.lessons}    label="Lessons" />}
            {modules.whiteboard       && <NavItem href="/whiteboard" icon={icons.whiteboard} label="Whiteboard" />}
          </>
        )}

        <SectionLabel>Mentorship</SectionLabel>
        <NavItem href="/mentorship" icon={icons.mentorship} label="Mentorship" />
        <NavItem href="/goals"      icon={icons.goals}      label="Goals" />
        {modules.professionalGrowth && <NavItem href="/career" icon={icons.career} label="Career Growth" />}

        {(modules.awesomeAwards || modules.certificates || modules.mileage || modules.seasonalReturns) && (
          <>
            <SectionLabel>Recognition & HR</SectionLabel>
            {modules.awesomeAwards   && <NavItem href="/awards"           icon={icons.awards}   label="Awesome Awards" />}
            {modules.certificates    && <NavItem href="/certificates"     icon={icons.certs}    label="Certificates" />}
            {modules.mileage         && <NavItem href="/mileage"          icon={icons.mileage}  label="Mileage" />}
            {modules.seasonalReturns && <NavItem href="/seasonal-returns" icon={icons.seasonal} label="Seasonal Returns" />}
          </>
        )}

        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            {modules.newHires      && <NavItem href="/new-hires"      icon={icons.newHires} label="New Hires" />}
            {modules.emailComposer && <NavItem href="/email-composer" icon={icons.email}    label="Email Composer" />}
            {modules.foiaExport    && <NavItem href="/foia-export"    icon={icons.foia}     label="FOIA Export" />}
            <NavItem href="/admin" icon={icons.admin} label="Admin" />
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="ap-border-t ap-border-gray-100 ap-p-3">
        <div className="ap-flex ap-items-center ap-gap-3 ap-rounded-lg ap-px-2 ap-py-2">
          <div className="ap-flex ap-h-8 ap-w-8 ap-shrink-0 ap-items-center ap-justify-center ap-rounded-full ap-bg-brand-100 ap-text-sm ap-font-bold ap-text-brand-700">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="ap-min-w-0 ap-flex-1">
            <p className="ap-truncate ap-text-sm ap-font-medium ap-text-gray-900">{user.displayName}</p>
            <p className="ap-truncate ap-text-xs ap-text-gray-500">{user.email}</p>
          </div>
          <SignOutButton iconOnly />
        </div>
      </div>
    </aside>
  );
}
