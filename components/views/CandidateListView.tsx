import { BriefcaseBusiness, ContactRound, Layers3, Sparkles } from "lucide-react";
import { EntityCard } from "@/components/EntityCard";
import { MetricCard } from "@/components/MetricCard";
import { RecordTable } from "@/components/RecordTable";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface CandidateListViewProps {
  run: RunResult;
}

export function CandidateListView({ run }: CandidateListViewProps) {
  const firstRecord = run.records[0];
  const representedCompanies = new Set(
    run.records.map((record) => String(record.derivedPayload?.company ?? "Unknown")),
  );
  const rows = run.records.slice(0, 8).map((record) => [
    record.inputKey,
    String(record.derivedPayload?.title ?? "Unknown"),
    String(record.derivedPayload?.company ?? "Unknown"),
    String(record.derivedPayload?.score ?? "n/a"),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="People enriched and carried through to the candidate shortlist."
          icon={<ContactRound className="h-4 w-4" />}
          label="Candidates"
          value={run.counts.enriched}
        />
        <MetricCard
          detail="Current companies represented in the returned candidate pool."
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="Companies"
          value={representedCompanies.size}
        />
        <MetricCard
          detail="Segments generated to help group or prioritize talent."
          icon={<Layers3 className="h-4 w-4" />}
          label="Segments"
          value={run.derivedInsights.segments.length}
        />
        <MetricCard
          detail="Highlights and recommendations ready for recruiter review."
          icon={<Sparkles className="h-4 w-4" />}
          label="Signals"
          value={
            run.derivedInsights.highlights.length +
            run.derivedInsights.recommendations.length
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <EntityCard
          badge={run.status}
          fields={[
            {
              label: "Current title",
              value: String(firstRecord?.derivedPayload?.title ?? "Unknown"),
            },
            {
              label: "Current company",
              value: String(firstRecord?.derivedPayload?.company ?? "Unknown"),
            },
            {
              label: "Source hint",
              value: firstRecord?.sourceHint ?? "Unknown",
            },
            {
              label: "Score",
              value: String(firstRecord?.derivedPayload?.score ?? "n/a"),
            },
          ]}
          subtitle={String(
            firstRecord?.derivedPayload?.summary ??
              "The top candidate summary appears here.",
          )}
          title={firstRecord?.inputKey ?? "No candidate selected"}
        />

        <SectionCard
          description={run.derivedInsights.summary}
          title="Recruiter notes"
        >
          <div className="grid gap-3">
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

      <SectionCard
        description="A dense candidate review table for the first records in the run."
        title="Candidate table"
      >
        <RecordTable
          caption="Use this view to scan titles, employers, and derived scores."
          columns={["Candidate", "Title", "Company", "Score"]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
