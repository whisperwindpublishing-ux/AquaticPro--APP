// Authenticated app shell layout
// TODO Phase 2: wrap with auth session check and redirect if not logged in

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* TODO: Sidebar nav */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden lg:block" />
      <div className="flex-1 flex flex-col">
        {/* TODO: Top header bar */}
        <header className="h-16 bg-white border-b border-gray-100" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
