type BadgeVariant = "default" | "neutral" | "success" | "warning" | "error" | "info" | "purple";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "ap-bg-gray-100 ap-text-gray-700",
  neutral: "ap-bg-gray-100 ap-text-gray-700",
  success: "ap-bg-success-100 ap-text-success-700",
  warning: "ap-bg-warning-100 ap-text-warning-700",
  error:   "ap-bg-error-100 ap-text-error-700",
  info:    "ap-bg-brand-100 ap-text-brand-700",
  purple:  "ap-bg-lavender-100 ap-text-lavender-700",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`ap-inline-flex ap-items-center ap-rounded-full ap-px-2.5 ap-py-0.5 ap-text-xs ap-font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Maps common status strings to badge variants */
export function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (["active", "completed", "approved", "published", "done"].includes(s)) return "success";
  if (["pending", "in-progress", "in_progress", "draft"].includes(s)) return "warning";
  if (["archived", "trash", "rejected", "failed"].includes(s)) return "error";
  if (["not started", "not_started", "new"].includes(s)) return "info";
  return "default";
}
