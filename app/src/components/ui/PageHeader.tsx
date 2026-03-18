import React from "react";

interface PageHeaderProps {
  title: string;
  /** Subheading text below the title. */
  subtitle?: React.ReactNode;
  /** Alias for subtitle — accepted for convenience. */
  description?: React.ReactNode;
  /** Action buttons / controls rendered on the right side. */
  right?: React.ReactNode;
  /** Alternative to `right` — children are rendered in the right slot. */
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, description, right, children }: PageHeaderProps) {
  const sub = subtitle ?? description;
  const actions = right ?? children;
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {sub && (
          <p className="mt-0.5 text-sm text-gray-500">{sub}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
