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
    <div className="ap-flex ap-min-h-screen ap-bg-gray-50">
      {/* Sidebar — hidden on mobile, shown lg+ */}
      <div className="ap-hidden ap-h-screen ap-sticky ap-top-0 lg:ap-flex ap-flex-col">
        <Sidebar user={user} permissions={permissions} />
      </div>

      {/* Main content area */}
      <div className="ap-flex ap-flex-1 ap-flex-col ap-min-w-0">
        {/* Mobile header (lg+ is handled by sidebar) */}
        <header className="ap-flex lg:ap-hidden ap-h-14 ap-items-center ap-justify-between ap-border-b ap-border-gray-100 ap-bg-white ap-px-4">
          <MobileNavDrawer user={user} permissions={permissions} />
          <span className="ap-text-sm ap-font-bold ap-text-gray-900">AquaticPro</span>
          <span className="ap-text-xs ap-text-gray-500 ap-truncate ap-max-w-[120px]">{user.displayName}</span>
        </header>

        <main className="ap-flex-1 ap-p-6">{children}</main>
      </div>
    </div>
  );
}
