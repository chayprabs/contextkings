import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
