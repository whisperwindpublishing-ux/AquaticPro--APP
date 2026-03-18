import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:   "bg-brand-500 text-white hover:bg-brand-600 border-transparent",
  secondary: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
  ghost:     "bg-transparent text-gray-600 border-transparent hover:bg-gray-100",
  danger:    "bg-error-500 text-white hover:bg-error-600 border-transparent",
};

const SIZE: Record<ButtonSize, string> = {
  sm:  "px-3 py-1.5 text-xs",
  md:  "px-4 py-2 text-sm",
  lg:  "px-5 py-2.5 text-base",
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
        "inline-flex items-center gap-2 rounded-lg border font-medium",
        "transition-colors duration-150 cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1",
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(" ")}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
