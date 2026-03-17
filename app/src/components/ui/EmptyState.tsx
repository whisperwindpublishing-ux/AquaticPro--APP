import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ap-flex ap-flex-col ap-items-center ap-justify-center ap-py-16 ap-text-center">
      {icon && (
        <div className="ap-mb-4 ap-flex ap-h-14 ap-w-14 ap-items-center ap-justify-center ap-rounded-full ap-bg-gray-100 ap-text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="ap-text-base ap-font-semibold ap-text-gray-900">{title}</h3>
      {description && (
        <p className="ap-mt-1 ap-text-sm ap-text-gray-500">{description}</p>
      )}
      {action && <div className="ap-mt-4">{action}</div>}
    </div>
  );
}
