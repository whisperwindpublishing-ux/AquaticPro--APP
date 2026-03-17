"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development; swap for an error-reporting service in prod
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="ap-flex ap-min-h-[60vh] ap-flex-col ap-items-center ap-justify-center ap-px-4 ap-text-center">
      <div className="ap-mb-6 ap-flex ap-h-20 ap-w-20 ap-items-center ap-justify-center ap-rounded-full ap-bg-red-50">
        <svg className="ap-h-10 ap-w-10 ap-text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Something went wrong</h2>
      <p className="ap-mt-2 ap-max-w-sm ap-text-sm ap-text-gray-500">
        An unexpected error occurred. If this keeps happening, please contact support.
      </p>
      {error.digest && (
        <p className="ap-mt-1 ap-font-mono ap-text-xs ap-text-gray-400">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="ap-mt-8 ap-inline-flex ap-items-center ap-gap-2 ap-rounded-lg ap-bg-brand-600 ap-px-5 ap-py-2.5 ap-text-sm ap-font-semibold ap-text-white ap-shadow-sm hover:ap-bg-brand-700 ap-transition-colors"
      >
        <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Try Again
      </button>
    </div>
  );
}
