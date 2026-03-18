import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | AquaticPro",
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1rem",
        background: "linear-gradient(135deg, #06091a 0%, #0c0433 50%, #06101e 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "384px" }}>
        {/* Gradient brand header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2)",
            borderRadius: "1rem 1rem 0 0",
            padding: "2rem 2rem 1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.2)",
              marginBottom: "1rem",
            }}
          >
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>
            AquaticPro
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "rgba(255,255,255,0.7)" }}>
            Sign in to your account
          </p>
        </div>

        {/* White form card */}
        <div
          style={{
            background: "white",
            borderRadius: "0 0 1rem 1rem",
            padding: "2rem",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}