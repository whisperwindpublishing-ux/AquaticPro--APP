import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "amber" | "purple" | "red";
}

const COLOR: Record<NonNullable<StatCardProps["color"]>, { icon: string; value: string }> = {
  blue:   { icon: "ap-bg-brand-100 ap-text-brand-600",       value: "ap-text-brand-700" },
  green:  { icon: "ap-bg-success-100 ap-text-success-600",   value: "ap-text-success-700" },
  amber:  { icon: "ap-bg-warning-100 ap-text-warning-600",   value: "ap-text-warning-700" },
  purple: { icon: "ap-bg-lavender-100 ap-text-lavender-600", value: "ap-text-lavender-700" },
  red:    { icon: "ap-bg-error-100 ap-text-error-600",       value: "ap-text-error-700" },
};

export function StatCard({ label, value, sub, icon, color = "blue" }: StatCardProps) {
  const c = COLOR[color];
  return (
    <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
      <div className="ap-flex ap-items-start ap-justify-between">
        <div>
          <p className="ap-text-sm ap-font-medium ap-text-gray-500">{label}</p>
          <p className={`ap-mt-1 ap-text-3xl ap-font-bold ${c.value}`}>{value}</p>
          {sub && <p className="ap-mt-1 ap-text-xs ap-text-gray-400">{sub}</p>}
        </div>
        {icon && (
          <div className={`ap-rounded-lg ap-p-2.5 ${c.icon}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
