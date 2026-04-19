import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  detail?: string;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  trend,
}: MetricCardProps) {
  return (
    <article className="rounded-[18px] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            {label}
          </div>
          <div className="mt-3 text-[2.2rem] font-semibold tracking-[-0.06em] text-foreground">
            {value}
          </div>
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>

      {trend ? (
        <div
          className={`mt-2 text-sm font-medium ${
            trend.direction === "up" ? "text-blue-400" : "text-rose-400"
          }`}
        >
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}
        </div>
      ) : null}

      {detail ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{detail}</p>
      ) : null}
    </article>
  );
}
