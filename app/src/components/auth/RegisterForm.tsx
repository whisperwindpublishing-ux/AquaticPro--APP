"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

const initialState = { error: "" };

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="ap-space-y-4">
      {/* Server error */}
      {state?.error && (
        <div className="ap-rounded-lg ap-bg-red-50 ap-border ap-border-red-200 ap-px-4 ap-py-3 ap-text-sm ap-text-red-600">
          {state.error}
        </div>
      )}

      <div className="ap-space-y-1">
        <label
          htmlFor="displayName"
          className="ap-block ap-text-sm ap-font-medium ap-text-gray-700"
        >
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-500/20"
          placeholder="Jane Smith"
        />
      </div>

      <div className="ap-space-y-1">
        <label
          htmlFor="email"
          className="ap-block ap-text-sm ap-font-medium ap-text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-500/20"
          placeholder="you@example.com"
        />
      </div>

      <div className="ap-space-y-1">
        <label
          htmlFor="password"
          className="ap-block ap-text-sm ap-font-medium ap-text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-500/20"
          placeholder="8+ characters"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="ap-w-full ap-rounded-lg ap-bg-brand-500 ap-px-4 ap-py-2.5 ap-text-sm ap-font-semibold ap-text-white hover:ap-bg-brand-600 disabled:ap-opacity-60 ap-transition-colors"
      >
        {isPending ? "Creating account…" : "Create Account"}
      </button>

      <p className="ap-text-center ap-text-sm ap-text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="ap-font-medium ap-text-brand-500 hover:ap-text-brand-600"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
