import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <article className="rounded-[26px] border border-border bg-card p-5 shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-[var(--accent)]">
            {label}
          </div>
          <div className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-foreground">
            {value}
          </div>
        </div>
        {icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{detail}</p>
      ) : null}
    </article>
  );
}
