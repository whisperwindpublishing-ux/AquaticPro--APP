import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | AquaticPro",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h1>
        {/* TODO Phase 2: wire up Supabase Auth login form */}
        <p className="text-sm text-gray-500">Login form coming in Phase 2.</p>
      </div>
    </main>
  );
}
