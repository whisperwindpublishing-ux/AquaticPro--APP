import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | AquaticPro",
};

export default function LoginPage() {
  return (
    <main
      className="ap-min-h-screen ap-flex ap-items-center ap-justify-center ap-px-4 ap-py-12"
      style={{ background: "linear-gradient(135deg, #06091a 0%, #0c0433 50%, #06101e 100%)" }}
    >
      <div className="ap-w-full ap-max-w-sm">
        {/* Gradient brand header */}
        <div
          className="ap-rounded-t-2xl ap-px-8 ap-pt-8 ap-pb-6 ap-text-center"
          style={{ background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)" }}
        >
          <div className="ap-inline-flex ap-h-12 ap-w-12 ap-items-center ap-justify-center ap-rounded-xl ap-bg-white/20 ap-mb-4">
            {/* Droplet / wave icon */}
            <svg className="ap-h-6 ap-w-6 ap-text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z" />
            </svg>
          </div>
          <h1 className="ap-text-xl ap-font-bold ap-text-white ap-tracking-tight">AquaticPro</h1>
          <p className="ap-mt-1 ap-text-sm ap-text-white/70">Sign in to your account</p>
        </div>

        {/* White form card */}
        <div className="ap-rounded-b-2xl ap-bg-white ap-p-8 ap-shadow-2xl">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>        </div>
      </main>
  );
}