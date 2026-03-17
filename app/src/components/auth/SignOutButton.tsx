"use client";

import { signOut } from "@/app/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
