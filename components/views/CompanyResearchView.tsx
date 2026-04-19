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
    name: String(record.derivedPayload?.name ?? record.inputKey),
    domain: String(record.derivedPayload?.domain ?? "n/a"),
    industry: String(record.derivedPayload?.industry ?? "Unknown"),
    headquarters: String(
      record.derivedPayload?.hq ?? record.derivedPayload?.hqCountry ?? "Unknown",
    ),
    fundingStage: String(record.derivedPayload?.fundingStage ?? "Unknown"),
    funding: String(record.derivedPayload?.funding ?? "n/a"),
    hiring: String(record.derivedPayload?.hiring ?? "n/a"),
    headcount: String(record.derivedPayload?.headcount ?? "n/a"),
    summary: String(record.derivedPayload?.summary ?? "Enriched company record"),
  }));
  const uniqueIndustries = new Set(companies.map((company) => company.industry));
  const uniqueHeadquarters = new Set(companies.map((company) => company.headquarters));
  const averageHeadcount = averageNumericLabel(
    companies.map((company) => parseLeadingNumber(company.headcount)),
  );
  const activeHiringCount = companies.filter(
    (company) => parseLeadingNumber(company.hiring) > 0,
  ).length;
  const averageFunding = averageNumericLabel(
    companies.map((company) => parseLeadingNumber(company.funding)),
    "",
  );

  const rankedItems = [...companies]
    .sort((left, right) => priorityScore(right) - priorityScore(left))
    .slice(0, 5)
    .map((company) => ({
      label: company.name,
      value: priorityBadge(company),
      detail: [company.industry, company.headquarters, company.domain]
        .filter((value) => value !== "Unknown" && value !== "n/a")
        .join(" · "),
    }));

  const companyRows = companies.slice(0, 8).map((company) => [
    company.name,
    company.domain,
    company.headquarters,
    company.industry,
    company.fundingStage,
    company.hiring,
    company.headcount,
  ]);

  const signalRows = run.derivedInsights.highlights
    .map((item) => ["Highlight", item])
    .concat(run.derivedInsights.recommendations.map((item) => ["Next move", item]))
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
          label="Companies Found"
          value={run.counts.enriched}
        />
        <MetricCard
          icon={<Globe className="h-4 w-4" />}
          label="HQ Markets"
          value={uniqueHeadquarters.size}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Avg Team Size"
          value={averageHeadcount}
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Hiring Companies"
          value={activeHiringCount}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          description="Highest-signal companies surfaced from the actual workflow output."
          title="Top Companies"
        >
          <RankedList items={rankedItems} />
        </SectionCard>

        <SectionCard
          description="Highlights and next moves derived from the returned company records."
          title="Research Highlights"
        >
          <RecordTable
            columns={["Type", "Detail"]}
            rows={
              signalRows.length > 0
                ? signalRows
                : [["Highlight", "Run again with a broader dataset to surface insights."]]
            }
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          icon={<Globe className="h-4 w-4" />}
          label="Industries"
          value={uniqueIndustries.size}
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Avg Funding"
          value={averageFunding}
        />
      </div>

      <SectionCard
        description="Structured company-by-company research output from the current run."
        title="All Companies"
      >
        <RecordTable
          caption="Showing company, domain, HQ, funding stage, hiring, and headcount context."
          columns={["Company", "Domain", "HQ", "Industry", "Funding Stage", "Hiring", "Headcount"]}
          rows={companyRows}
        />
      </SectionCard>
    </div>
  );
}

function parseLeadingNumber(value: string) {
  const match = value.match(/(-?\d+(?:\.\d+)?)(\s*[kmb])?/i);
  if (!match) {
    return 0;
  }

  let numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const suffix = match[2]?.trim().toLowerCase();
  if (suffix === "b") {
    numeric *= 1_000_000_000;
  } else if (suffix === "m") {
    numeric *= 1_000_000;
  } else if (suffix === "k") {
    numeric *= 1_000;
  }

  return numeric;
}

function averageNumericLabel(values: number[], suffix = "") {
  const filtered = values.filter((value) => value > 0);
  if (filtered.length === 0) {
    return "n/a";
  }

  const average =
    filtered.reduce((total, value) => total + value, 0) / filtered.length;

  if (average >= 1_000_000) {
    return `${(average / 1_000_000).toFixed(1)}M${suffix}`;
  }

  if (average >= 1000) {
    return `${(average / 1000).toFixed(1)}k${suffix}`;
  }

  return `${Math.round(average)}${suffix}`;
}

function priorityScore(company: {
  funding: string;
  hiring: string;
  headcount: string;
}) {
  return (
    parseLeadingNumber(company.funding) +
    parseLeadingNumber(company.hiring) * 1_000_000 +
    parseLeadingNumber(company.headcount)
  );
}

function priorityBadge(company: {
  fundingStage: string;
  hiring: string;
  headcount: string;
}) {
  const hiring = parseLeadingNumber(company.hiring);
  if (hiring > 0) {
    return `${hiring} openings`;
  }

  if (company.fundingStage !== "Unknown") {
    return company.fundingStage;
  }

  if (parseLeadingNumber(company.headcount) > 0) {
    return `${company.headcount} team`;
  }

  return undefined;
}
