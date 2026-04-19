interface EntityField {
  label: string;
  value: string;
}

interface EntityCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  fields?: EntityField[];
  tags?: string[];
}

export function EntityCard({
  title,
  subtitle,
  description,
  badge,
  fields = [],
  tags = [],
}: EntityCardProps) {
  return (
    <article className="rounded-[18px] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
            {title}
          </h4>
          {subtitle ? (
            <p className="mt-1 text-base text-muted-foreground">
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

      {description ? (
        <p className="mt-4 text-sm leading-8 text-muted-foreground">{description}</p>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-[#141414] px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {fields.length > 0 ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={`${field.label}-${field.value}`}
              className="rounded-xl bg-[#111111] px-4 py-3"
            >
              <div className="text-xs text-muted-foreground">{field.label}</div>
              <div className="mt-1 text-xl font-medium tracking-[-0.03em] text-foreground">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
