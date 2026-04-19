interface RankedItem {
  label: string;
  value?: string;
  detail?: string;
}

interface RankedListProps {
  items: RankedItem[];
}

export function RankedList({ items }: RankedListProps) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex items-start gap-4 rounded-[24px] border border-border bg-background px-4 py-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-sm font-semibold text-foreground">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-6 text-foreground">{item.label}</div>
            {item.detail ? (
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {item.detail}
              </div>
            ) : null}
          </div>
          {item.value ? (
            <div className="rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {item.value}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
