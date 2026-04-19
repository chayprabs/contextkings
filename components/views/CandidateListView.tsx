import { BriefcaseBusiness, ContactRound, Layers3, Sparkles } from "lucide-react";
import { EntityCard } from "@/components/EntityCard";
import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface CandidateListViewProps {
  run: RunResult;
}

export function CandidateListView({ run }: CandidateListViewProps) {
  const candidates = run.records.map((record) => ({
    name: record.inputKey,
    title: String(record.derivedPayload?.title ?? "Unknown"),
    company: String(record.derivedPayload?.company ?? "Unknown"),
    score: String(record.derivedPayload?.score ?? "n/a"),
    summary: String(record.derivedPayload?.summary ?? "Candidate profile ready for review."),
    source: record.sourceHint,
  }));
  const representedCompanies = new Set(candidates.map((candidate) => candidate.company));
  const representedTitles = new Set(candidates.map((candidate) => candidate.title));

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
          icon={<ContactRound className="h-4 w-4" />}
          label="Candidates Found"
          value={run.counts.enriched}
        />
        <MetricCard
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="Companies"
          value={representedCompanies.size}
        />
        <MetricCard
          icon={<Layers3 className="h-4 w-4" />}
          label="Titles"
          value={representedTitles.size}
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Signals"
          value={
            run.derivedInsights.highlights.length +
            run.derivedInsights.recommendations.length
          }
        />
      </div>

      <SectionCard
        description="Profiles surfaced by the run, using live records instead of the placeholder demo cards."
        title="Top Candidates"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {candidates.slice(0, 6).map((candidate) => (
            <EntityCard
              key={`${candidate.name}-${candidate.company}`}
              badge={candidate.score}
              description={candidate.summary}
              fields={[
                { label: "Company", value: candidate.company },
                { label: "Role", value: candidate.title },
              ]}
              tags={dedupeTags([candidate.company, candidate.source, candidate.title])}
              subtitle={candidate.title}
              title={candidate.name}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function dedupeTags(tags: string[]) {
  return [...new Set(tags.filter(Boolean))].slice(0, 3);
}
