type BadgeVariant = "default" | "neutral" | "success" | "warning" | "error" | "info" | "purple";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  neutral: "bg-gray-100 text-gray-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error:   "bg-error-100 text-error-700",
  info:    "bg-brand-100 text-brand-700",
  purple:  "bg-lavender-100 text-lavender-700",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
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
