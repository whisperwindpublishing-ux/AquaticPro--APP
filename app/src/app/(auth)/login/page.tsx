import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | AquaticPro",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">AquaticPro</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>
        {/* Suspense required because LoginForm calls useSearchParams() */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
