import { TrendingUp } from 'lucide-react';

interface RankedItem {
  rank: number;
  name: string;
  value: string | number;
  score?: number;
  metadata?: string;
}

interface RankedListProps {
  items: RankedItem[];
}

export function RankedList({ items }: RankedListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.rank}
          className="p-3 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-sm text-foreground">
              {item.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground mb-0.5 truncate">{item.name}</div>
                  {item.metadata && (
                    <div className="text-xs text-muted-foreground">{item.metadata}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm text-foreground">{item.value}</div>
                  {item.score !== undefined && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {item.score}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}