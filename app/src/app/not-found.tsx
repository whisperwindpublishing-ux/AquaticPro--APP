import Link from "next/link";

export default function NotFound() {
  return (
    <div className="ap-flex ap-min-h-screen ap-flex-col ap-items-center ap-justify-center ap-bg-gray-50 ap-px-4 ap-text-center">
      <div className="ap-mb-6 ap-flex ap-h-20 ap-w-20 ap-items-center ap-justify-center ap-rounded-full ap-bg-brand-50">
        <svg className="ap-h-10 ap-w-10 ap-text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="ap-text-5xl ap-font-extrabold ap-text-gray-900">404</h1>
      <p className="ap-mt-3 ap-text-lg ap-font-medium ap-text-gray-700">Page not found</p>
      <p className="ap-mt-2 ap-text-sm ap-text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="ap-mt-8 ap-inline-flex ap-items-center ap-gap-2 ap-rounded-lg ap-bg-brand-600 ap-px-5 ap-py-2.5 ap-text-sm ap-font-semibold ap-text-white ap-shadow-sm hover:ap-bg-brand-700 ap-transition-colors"
      >
        <svg className="ap-h-4 ap-w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Back to Dashboard
      </Link>
    </div>
  );
}
