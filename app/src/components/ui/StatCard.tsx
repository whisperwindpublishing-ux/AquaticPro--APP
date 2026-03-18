import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "amber" | "purple" | "red";
}

const COLOR: Record<NonNullable<StatCardProps["color"]>, { icon: string; value: string }> = {
  blue:   { icon: "bg-brand-100 text-brand-600",       value: "text-brand-700" },
  green:  { icon: "bg-success-100 text-success-600",   value: "text-success-700" },
  amber:  { icon: "bg-warning-100 text-warning-600",   value: "text-warning-700" },
  purple: { icon: "bg-lavender-100 text-lavender-600", value: "text-lavender-700" },
  red:    { icon: "bg-error-100 text-error-600",       value: "text-error-700" },
};

export function StatCard({ label, value, sub, icon, color = "blue" }: StatCardProps) {
  const c = COLOR[color];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-3xl font-bold ${c.value}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        {icon && (
          <div className={`rounded-lg p-2.5 ${c.icon}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
