import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ap-min-h-screen ap-bg-gray-50">
      {/* Gradient accent bar */}
      <div
        className="ap-h-1.5"
        style={{ background: "linear-gradient(90deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
      />

      {/* Logo strip */}
      <header className="ap-bg-white ap-border-b ap-border-gray-100 ap-px-6 ap-py-4">
        <div className="ap-mx-auto ap-max-w-2xl ap-flex ap-items-center ap-gap-2.5">
          <div
            className="ap-h-7 ap-w-7 ap-rounded-lg ap-shrink-0"
            style={{ background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
          />
          <span className="ap-text-lg ap-font-bold ap-text-gray-900">AquaticPro</span>
        </div>
      </header>

      {/* Page content */}
      <main className="ap-mx-auto ap-max-w-2xl ap-px-6 ap-py-10">{children}</main>

      <footer className="ap-py-8 ap-text-center ap-text-xs ap-text-gray-400">
        © {new Date().getFullYear()} AquaticPro. All rights reserved.
      </footer>
    </div>
  );
}
