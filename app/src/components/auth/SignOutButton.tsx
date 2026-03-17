"use client";

import { signOut } from "@/app/actions/auth";

export default function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        title="Sign out"
        className="ap-flex ap-items-center ap-justify-center ap-rounded-lg ap-p-1.5 ap-text-gray-400 ap-transition-colors hover:ap-bg-gray-100 hover:ap-text-gray-600"
      >
        {iconOnly ? (
          /* logout icon */
          <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        ) : (
          <span className="ap-text-xs ap-font-medium">Sign out</span>
        )}
      </button>
    </form>
  );
}
