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
    <div className="ap-mb-6 ap-flex ap-items-start ap-justify-between ap-gap-4">
      <div>
        <h1 className="ap-text-2xl ap-font-bold ap-tracking-tight ap-text-gray-900">
          {title}
        </h1>
        {sub && (
          <p className="ap-mt-0.5 ap-text-sm ap-text-gray-500">{sub}</p>
        )}
      </div>
      {actions && <div className="ap-flex ap-shrink-0 ap-items-center ap-gap-2">{actions}</div>}
    </div>
  );
}
