import { Activity, Building2, Flag, Sparkles } from "lucide-react";
import { EntityCard } from "@/components/EntityCard";
import { MetricCard } from "@/components/MetricCard";
import { RankedList } from "@/components/RankedList";
import { RecordTable } from "@/components/RecordTable";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface CompanyResearchViewProps {
  run: RunResult;
}

export function CompanyResearchView({ run }: CompanyResearchViewProps) {
  const firstRecord = run.records[0];
  const rankedItems = run.records.slice(0, 5).map((record) => ({
    label: record.inputKey,
    value: String(record.derivedPayload?.score ?? "ready"),
    detail: String(
      record.derivedPayload?.industry ??
        record.derivedPayload?.summary ??
        "Enriched company record",
    ),
  }));
  const recordsTable = run.records.slice(0, 8).map((record) => [
    record.inputKey,
    String(record.derivedPayload?.industry ?? "Unknown"),
    String(record.derivedPayload?.headcount ?? "n/a"),
    String(record.derivedPayload?.score ?? "n/a"),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Company records enriched in the final run."
          icon={<Building2 className="h-4 w-4" />}
          label="Companies"
          value={run.counts.enriched}
        />
        <MetricCard
          detail="Signals and recommendations surfaced by the analysis step."
          icon={<Sparkles className="h-4 w-4" />}
          label="Insights"
          value={run.derivedInsights.highlights.length}
        />
        <MetricCard
          detail="Distinct segment buckets generated from the result set."
          icon={<Activity className="h-4 w-4" />}
          label="Segments"
          value={run.derivedInsights.segments.length}
        />
        <MetricCard
          detail="Warnings that may affect source coverage or fidelity."
          icon={<Flag className="h-4 w-4" />}
          label="Warnings"
          value={run.warnings.length}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          description={run.derivedInsights.summary}
          title="Top companies"
        >
          <RankedList items={rankedItems} />
        </SectionCard>

        <EntityCard
          badge={run.status}
          fields={[
            {
              label: "Source hint",
              value: firstRecord?.sourceHint ?? "No records",
            },
            {
              label: "Industry",
              value: String(firstRecord?.derivedPayload?.industry ?? "Unknown"),
            },
            {
              label: "Headcount",
              value: String(firstRecord?.derivedPayload?.headcount ?? "n/a"),
            },
            {
              label: "Score",
              value: String(firstRecord?.derivedPayload?.score ?? "n/a"),
            },
          ]}
          subtitle={String(
            firstRecord?.derivedPayload?.summary ??
              "The first record in the run is summarized here.",
          )}
          title={firstRecord?.inputKey ?? "No company selected"}
        />
      </div>

      <SectionCard
        description="Preview the structured records that power the generated workspace."
        title="Company table"
      >
        <RecordTable
          caption="Showing the first records from the normalized run payload."
          columns={["Company", "Industry", "Headcount", "Score"]}
          rows={recordsTable}
        />
      </SectionCard>
    </div>
  );
}
