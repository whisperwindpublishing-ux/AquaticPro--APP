export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "ap-h-4 ap-w-4" : size === "lg" ? "ap-h-10 ap-w-10" : "ap-h-6 ap-w-6";
  return (
    <svg
      className={`${dim} ap-animate-spin ap-text-brand-500`}
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="ap-opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="ap-opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="ap-flex ap-h-64 ap-items-center ap-justify-center">
      <Spinner size="lg" />
    </div>
  );
}
