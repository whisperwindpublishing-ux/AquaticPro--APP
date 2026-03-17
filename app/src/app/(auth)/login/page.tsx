import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | AquaticPro",
};

export default function LoginPage() {
  return (
    <main className="ap-min-h-screen ap-flex ap-items-center ap-justify-center ap-bg-gray-50">
      <div className="ap-w-full ap-max-w-sm ap-p-8 ap-bg-white ap-rounded-2xl ap-shadow-sm ap-border ap-border-gray-100">
        {/* Logo / wordmark */}
          <div className="ap-mb-8 ap-text-center">
          <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">AquaticPro</h1>
          <p className="ap-mt-1 ap-text-sm ap-text-gray-500">Sign in to your account</p>
        </div>
        {/* Suspense required because LoginForm calls useSearchParams() */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
