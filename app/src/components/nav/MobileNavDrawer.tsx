"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserPermissions } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import SignOutButton from "@/components/auth/SignOutButton";

// ─── Icons ───────────────────────────────────────────────────────────────────

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const icons = {
  dashboard:  "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  logs:       "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  taskdeck:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  courses:    "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  lessons:    "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  whiteboard: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  mentorship: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  goals:      "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  career:     "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  awards:     "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  certs:      "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  mileage:    "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  seasonal:   "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  newHires:   "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  email:      "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  foia:       "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  admin:      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  profile:    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
};

interface NavItemProps { href: string; icon: string; label: string; onClick: () => void; }

function NavItem({ href, icon, label, onClick }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      ].join(" ")}
    >
      <span className={active ? "text-sky-400" : "text-slate-500"}>
        <Icon d={icon} />
      </span>
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

interface Props {
  user: SessionUser;
  permissions: UserPermissions;
}

export function MobileNavDrawer({ user, permissions }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { modules, isAdmin } = permissions;

  // Close drawer on route change
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm"
          aria-hidden="true"
          onClick={close}
        />
      )}

      {/* Drawer */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg shrink-0"
              style={{ background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
            />
            <span className="text-base font-bold text-white">AquaticPro</span>
          </div>
          <button
            onClick={close}
            aria-label="Close navigation"
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <SectionLabel>Core</SectionLabel>
          <NavItem href="/dashboard" icon={icons.dashboard} label="Dashboard" onClick={close} />
          {modules.dailyLogs     && <NavItem href="/daily-logs" icon={icons.logs}      label="Daily Logs"    onClick={close} />}
          {modules.taskdeck      && <NavItem href="/taskdeck"   icon={icons.taskdeck}  label="Task Deck"     onClick={close} />}

          {(modules.lms || modules.lessonManagement || modules.whiteboard) && (
            <>
              <SectionLabel>Learning</SectionLabel>
              {modules.lms         && <NavItem href="/courses"    icon={icons.courses}    label="Courses"    onClick={close} />}
              {modules.lms         && <NavItem href="/lessons"    icon={icons.lessons}    label="Lessons"    onClick={close} />}
              {modules.whiteboard  && <NavItem href="/whiteboard" icon={icons.whiteboard} label="Whiteboard" onClick={close} />}
            </>
          )}

          <SectionLabel>Mentorship</SectionLabel>
          <NavItem href="/mentorship" icon={icons.mentorship} label="Mentorship"    onClick={close} />
          <NavItem href="/goals"      icon={icons.goals}      label="Goals"         onClick={close} />
          {modules.professionalGrowth && <NavItem href="/career" icon={icons.career} label="Career Growth" onClick={close} />}

          {(modules.awesomeAwards || modules.certificates || modules.mileage || modules.seasonalReturns) && (
            <>
              <SectionLabel>Recognition & HR</SectionLabel>
              {modules.awesomeAwards   && <NavItem href="/awards"           icon={icons.awards}   label="Awesome Awards"    onClick={close} />}
              {modules.certificates    && <NavItem href="/certificates"     icon={icons.certs}    label="Certificates"      onClick={close} />}
              {modules.mileage         && <NavItem href="/mileage"          icon={icons.mileage}  label="Mileage"           onClick={close} />}
              {modules.seasonalReturns && <NavItem href="/seasonal-returns" icon={icons.seasonal} label="Seasonal Returns"  onClick={close} />}
            </>
          )}

          {isAdmin && (
            <>
              <SectionLabel>Admin</SectionLabel>
              {modules.newHires      && <NavItem href="/new-hires"      icon={icons.newHires} label="New Hires"       onClick={close} />}
              {modules.emailComposer && <NavItem href="/email-composer" icon={icons.email}    label="Email Composer"  onClick={close} />}
              {modules.foiaExport    && <NavItem href="/foia-export"    icon={icons.foia}     label="FOIA Export"     onClick={close} />}
              <NavItem href="/admin" icon={icons.admin} label="Admin" onClick={close} />
            </>
          )}

          <SectionLabel>Account</SectionLabel>
          <NavItem href="/profile" icon={icons.profile} label="My Profile" onClick={close} />
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                 style={{ background: "linear-gradient(135deg, #0004ff, #9f0fff)" }}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{user.displayName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <SignOutButton iconOnly />
          </div>
        </div>
      </aside>
    </>
  );
}
