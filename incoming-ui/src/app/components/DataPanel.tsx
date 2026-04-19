import { Download, Clock, Database, AlertCircle } from 'lucide-react';

interface Run {
  id: string;
  title: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  recordCount: number;
  entityType: string;
}

interface DataPanelProps {
  runs: Run[];
  selectedRun: Run | null;
  onSelectRun: (run: Run) => void;
  onExport: () => void;
}

export function DataPanel({ runs, selectedRun, onSelectRun, onExport }: DataPanelProps) {
  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">Data & Results</h2>
        <button
          onClick={onExport}
          disabled={!selectedRun}
          className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs text-muted-foreground mb-3">Saved Runs</h3>
          <div className="space-y-2">
            {runs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No runs yet
              </div>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => onSelectRun(run)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRun?.id === run.id
                      ? 'bg-accent border-border'
                      : 'bg-card border-border hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm flex-1 line-clamp-1 text-foreground">{run.title}</span>
                    {run.status === 'warning' && (
                      <AlertCircle className="w-3.5 h-3.5 text-chart-4 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {run.timestamp}
                    </span>
                    <span>{run.recordCount} records</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedRun && (
          <div className="p-4 border-t border-border">
            <h3 className="text-xs text-muted-foreground mb-3">Run Details</h3>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Entity Type</div>
                <div className="text-sm text-foreground">{selectedRun.entityType}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Records Found</div>
                <div className="text-sm flex items-center gap-2 text-foreground">
                  <Database className="w-4 h-4" />
                  {selectedRun.recordCount}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <div className="text-sm capitalize flex items-center gap-2 text-foreground">
                  {selectedRun.status === 'success' && (
                    <div className="w-2 h-2 rounded-full bg-chart-2" />
                  )}
                  {selectedRun.status === 'warning' && (
                    <div className="w-2 h-2 rounded-full bg-chart-4" />
                  )}
                  {selectedRun.status}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}