import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:   "ap-bg-brand-500 ap-text-white hover:ap-bg-brand-600 ap-border-transparent",
  secondary: "ap-bg-white ap-text-gray-700 ap-border-gray-300 hover:ap-bg-gray-50",
  ghost:     "ap-bg-transparent ap-text-gray-600 ap-border-transparent hover:ap-bg-gray-100",
  danger:    "ap-bg-error-500 ap-text-white hover:ap-bg-error-600 ap-border-transparent",
};

const SIZE: Record<ButtonSize, string> = {
  sm:  "ap-px-3 ap-py-1.5 ap-text-xs",
  md:  "ap-px-4 ap-py-2 ap-text-sm",
  lg:  "ap-px-5 ap-py-2.5 ap-text-base",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        "ap-inline-flex ap-items-center ap-gap-2 ap-rounded-lg ap-border ap-font-medium",
        "ap-transition-colors ap-duration-150 ap-cursor-pointer",
        "disabled:ap-opacity-50 disabled:ap-cursor-not-allowed",
        "focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-400 focus:ap-ring-offset-1",
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(" ")}
    >
      {loading && (
        <svg className="ap-h-4 ap-w-4 ap-animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
