import { ArrowRightLeft, BarChart3, Building2, Sparkles } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { RecordTable } from "@/components/RecordTable";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface ComparisonViewProps {
  run: RunResult;
}

export function ComparisonView({ run }: ComparisonViewProps) {
  const compared = run.records.slice(0, 3).map((record) => ({
    name: record.inputKey,
    category: String(
      record.derivedPayload?.industry ?? record.derivedPayload?.company ?? "Unknown",
    ),
    signal: String(
      record.derivedPayload?.headcount ?? record.derivedPayload?.title ?? "n/a",
    ),
    score: String(record.derivedPayload?.score ?? "n/a"),
  }));
  const categories = new Set(compared.map((record) => record.category));
  const matrixRows = [
    ["Category", ...compared.map((record) => record.category)],
    ["Signal", ...compared.map((record) => record.signal)],
    ["Score", ...compared.map((record) => record.score)],
  ];
  const takeaways = run.derivedInsights.highlights
    .concat(run.derivedInsights.recommendations)
    .slice(0, 6);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-[2.6rem] font-semibold tracking-[-0.06em] text-foreground">
          {run.derivedInsights.title}
        </h1>
        <p className="mt-2 max-w-3xl text-lg leading-8 text-muted-foreground">
          {run.derivedInsights.summary}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Building2 className="h-4 w-4" />}
          label="Compared"
          value={compared.length}
        />
        <MetricCard
          icon={<ArrowRightLeft className="h-4 w-4" />}
          label="Categories"
          value={categories.size}
        />
        <MetricCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Segments"
          value={run.derivedInsights.segments.length}
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Highlights"
          value={run.derivedInsights.highlights.length}
        />
      </div>

      <SectionCard
        description="The side-by-side comparison view from the workflow output."
        title="Comparison Matrix"
      >
        <RecordTable
          columns={["Metric", ...compared.map((record) => record.name)]}
          rows={matrixRows}
        />
      </SectionCard>

      <SectionCard
        description="Plain-language takeaways distilled from the comparison run."
        title="Takeaways"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {takeaways.length > 0 ? (
            takeaways.map((item) => (
              <div
                key={item}
                className="rounded-[16px] border border-border bg-[#111111] px-4 py-4 text-sm leading-7 text-foreground"
              >
                {item}
              </div>
            ))
          ) : (
            <div className="rounded-[16px] border border-border bg-[#111111] px-4 py-4 text-sm leading-7 text-muted-foreground">
              No comparison takeaways were generated for this run.
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
