import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Gradient accent bar */}
      <div
        className="h-1.5"
        style={{ background: "linear-gradient(90deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
      />

      {/* Logo strip */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-lg shrink-0"
            style={{ background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
          />
          <span className="text-lg font-bold text-gray-900">AquaticPro</span>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>

      <footer className="py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} AquaticPro. All rights reserved.
      </footer>
    </div>
  );
}
