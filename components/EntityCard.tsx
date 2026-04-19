interface EntityField {
  label: string;
  value: string;
}

interface EntityCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  fields: EntityField[];
}

export function EntityCard({
  title,
  subtitle,
  badge,
  fields,
}: EntityCardProps) {
  return (
    <article className="rounded-[30px] border border-border bg-card p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
            {title}
          </h4>
          {subtitle ? (
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={`${field.label}-${field.value}`}
            className="rounded-[22px] border border-border bg-background px-4 py-3"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              {field.label}
            </div>
            <div className="mt-3 text-sm font-medium leading-6 text-foreground">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
