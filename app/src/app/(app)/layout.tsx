import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import SignOutButton from "@/components/auth/SignOutButton";

/**
 * Authenticated app shell layout.
 * Redirects to /login if the user has no valid Supabase session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar nav — Phase 3 */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden lg:block">
        <div className="flex h-16 items-center px-6 border-b border-gray-100">
          <span className="font-bold text-gray-900">AquaticPro</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Top header bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
          <span className="text-sm text-gray-600">
            {user.displayName}
          </span>
          <SignOutButton />
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
