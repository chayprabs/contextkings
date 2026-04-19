import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </div>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      ) : null}
    </article>
  );
}
