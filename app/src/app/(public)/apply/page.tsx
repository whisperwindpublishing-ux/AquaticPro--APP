import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Hire Application | AquaticPro",
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">New Hire Application</h1>
      {/* TODO Phase 6: public-facing new hire application form */}
      <p className="text-gray-500">Public application form coming soon.</p>
    </main>
  );
}
