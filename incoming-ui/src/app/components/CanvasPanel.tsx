import { Loader2, AlertTriangle, Search } from 'lucide-react';

type CanvasState = 'empty' | 'planning' | 'running' | 'populated' | 'warning' | 'no-results';

interface CanvasPanelProps {
  state: CanvasState;
  children?: React.ReactNode;
}

export function CanvasPanel({ state, children }: CanvasPanelProps) {
  if (state === 'empty') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-foreground">Ready to build</h3>
          <p className="text-sm text-muted-foreground">
            Describe your research workflow and I'll create a structured dashboard for you.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'planning') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Planning your workflow...</p>
        </div>
      </div>
    );
  }

  if (state === 'running') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm">Running research pipeline...</p>
        </div>
      </div>
    );
  }

  if (state === 'no-results') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-foreground">No results found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try refining your criteria or broadening your search parameters.
          </p>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity">
            Adjust filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      {state === 'warning' && (
        <div className="mx-6 mt-6 p-3 bg-chart-4/10 border border-chart-4/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-chart-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm mb-1 text-foreground">Partial results</div>
            <div className="text-xs text-muted-foreground">
              Some data sources were unavailable. Results may be incomplete.
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}