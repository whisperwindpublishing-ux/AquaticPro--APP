import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNavDrawer } from "@/components/nav/MobileNavDrawer";

/**
 * Authenticated app shell layout.
 * Resolves session + permissions server-side, passes them to the client Sidebar.
 * Redirects to /login if unauthenticated.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const permissions = await resolvePermissions(user.id);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar — hidden on mobile, shown lg+ */}
      <div className="hidden h-screen sticky top-0 lg:flex flex-col">
        <Sidebar user={user} permissions={permissions} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header (lg+ is handled by sidebar) */}
        <header className="flex lg:hidden h-14 items-center justify-between border-b border-white/10 bg-slate-900 px-4">
          <MobileNavDrawer user={user} permissions={permissions} />
          <span className="text-sm font-bold text-white">AquaticPro</span>
          <span className="text-xs text-slate-400 truncate max-w-[120px]">{user.displayName}</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
