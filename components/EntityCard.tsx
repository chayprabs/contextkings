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
    <article className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h4>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={`${field.label}-${field.value}`}
            className="rounded-2xl border border-border bg-background px-4 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {field.label}
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
