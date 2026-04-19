import { ArrowRightLeft, BarChart3, Building2, Sparkles } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { RecordTable } from "@/components/RecordTable";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface ComparisonViewProps {
  run: RunResult;
}

export function ComparisonView({ run }: ComparisonViewProps) {
  const rows = run.records.slice(0, 3).map((record) => [
    record.inputKey,
    String(record.derivedPayload?.industry ?? record.derivedPayload?.company ?? "Unknown"),
    String(record.derivedPayload?.headcount ?? record.derivedPayload?.title ?? "n/a"),
    String(record.derivedPayload?.score ?? "n/a"),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Entities placed into the side-by-side comparison."
          icon={<Building2 className="h-4 w-4" />}
          label="Compared"
          value={run.records.length}
        />
        <MetricCard
          detail="Highlights generated to explain the comparison outcome."
          icon={<Sparkles className="h-4 w-4" />}
          label="Highlights"
          value={run.derivedInsights.highlights.length}
        />
        <MetricCard
          detail="Segment buckets available for grouping or slicing."
          icon={<BarChart3 className="h-4 w-4" />}
          label="Segments"
          value={run.derivedInsights.segments.length}
        />
        <MetricCard
          detail="Warnings attached to this comparison run."
          icon={<ArrowRightLeft className="h-4 w-4" />}
          label="Warnings"
          value={run.warnings.length}
        />
      </div>

      <SectionCard
        description={run.derivedInsights.summary}
        title="Comparison matrix"
      >
        <RecordTable
          caption="Showing the key fields surfaced by the comparison workflow."
          columns={["Entity", "Category", "Signal", "Score"]}
          rows={rows}
        />
      </SectionCard>

      <SectionCard
        description="The analysis step turned the shortlist into plain-language takeaways."
        title="Takeaways"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {run.derivedInsights.highlights
            .concat(run.derivedInsights.recommendations)
            .slice(0, 6)
            .map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground"
              >
                {item}
              </div>
            ))}
        </div>
      </SectionCard>
    </div>
  );
}
