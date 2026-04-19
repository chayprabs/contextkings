import { Building2, Globe, Sparkles, Users } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { RankedList } from "@/components/RankedList";
import { RecordTable } from "@/components/RecordTable";
import { SectionCard } from "@/components/SectionCard";
import type { RunResult } from "@/lib/workflow/schema";

interface CompanyResearchViewProps {
  run: RunResult;
}

export function CompanyResearchView({ run }: CompanyResearchViewProps) {
  const companies = run.records.map((record) => ({
    name: record.inputKey,
    industry: String(record.derivedPayload?.industry ?? "Unknown"),
    headcount: String(record.derivedPayload?.headcount ?? "n/a"),
    score: String(record.derivedPayload?.score ?? "n/a"),
    summary: String(record.derivedPayload?.summary ?? "Enriched company record"),
  }));
  const uniqueIndustries = new Set(companies.map((company) => company.industry));
  const averageHeadcount = averageNumericLabel(
    companies.map((company) => parseLeadingNumber(company.headcount)),
  );
  const averageScore = averageNumericLabel(
    companies.map((company) => parseLeadingNumber(company.score)),
    "",
  );

  const rankedItems = [...companies]
    .sort((left, right) => parseLeadingNumber(right.score) - parseLeadingNumber(left.score))
    .slice(0, 5)
    .map((company) => ({
      label: company.name,
      value: company.score === "n/a" ? undefined : company.score,
      detail: `${company.industry} · ${company.headcount} employees`,
    }));

  const tableRows = companies.slice(0, 8).map((company) => [
    company.name,
    company.industry,
    company.headcount,
    company.score,
  ]);

  const signalRows = run.derivedInsights.highlights
    .concat(run.derivedInsights.recommendations)
    .slice(0, 6)
    .map((item, index) => [
      companies[index]?.name ?? `Signal ${index + 1}`,
      item,
    ]);

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
          label="Companies Found"
          value={run.counts.enriched}
        />
        <MetricCard
          icon={<Globe className="h-4 w-4" />}
          label="Industries"
          value={uniqueIndustries.size}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Avg Team Size"
          value={averageHeadcount}
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Avg Score"
          value={averageScore}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          description="Highest-signal companies surfaced from the workflow output."
          title="Top Companies"
        >
          <RankedList items={rankedItems} />
        </SectionCard>

        <SectionCard
          description="Key takeaways the pipeline surfaced while enriching and scoring the list."
          title="Recent Signals"
        >
          <RecordTable
            columns={["Company", "Signal"]}
            rows={signalRows.length > 0 ? signalRows : [["No signals yet", "Run again with a broader dataset to surface highlights."]]}
          />
        </SectionCard>
      </div>

      <SectionCard
        description="Structured records from the current run, ready for export or follow-up filtering."
        title="All Companies"
      >
        <RecordTable
          caption="Showing the first enriched company records from the current run."
          columns={["Company Name", "Industry", "Employees", "Score"]}
          rows={tableRows}
        />
      </SectionCard>
    </div>
  );
}

function parseLeadingNumber(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function averageNumericLabel(values: number[], suffix = "") {
  const filtered = values.filter((value) => value > 0);
  if (filtered.length === 0) {
    return "n/a";
  }

  const average =
    filtered.reduce((total, value) => total + value, 0) / filtered.length;

  if (average >= 1000) {
    return `${(average / 1000).toFixed(1)}k${suffix}`;
  }

  return `${Math.round(average)}${suffix}`;
}
