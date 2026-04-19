import { CrustDataClient } from "@/lib/crustdata/client";
import { buildFallbackRunSpec } from "@/lib/ui/specs";
import { type RecordEnvelope, type RunResult, type ThreadState, type ValidatedWorkflowSpec } from "@/lib/workflow/schema";

type UnknownRecord = Record<string, unknown>;

export async function runWorkflow(spec: ValidatedWorkflowSpec, threadState: ThreadState): Promise<RunResult> {
  const now = new Date().toISOString();
  const runId = `run-${crypto.randomUUID()}`;
  const workflowId = `workflow-${crypto.randomUUID()}`;

  try {
    let records: RecordEnvelope[];
    const warnings = [...spec.warnings];

    if (!process.env.CRUSTDATA_API_KEY) {
      records = buildMockRecords(spec, threadState);
      warnings.push("Live CrustData credentials are not configured, so the run was fulfilled with a realistic mock dataset.");
    } else {
      const client = new CrustDataClient(process.env.CRUSTDATA_API_KEY);
      records = await executeLiveWorkflow(client, spec);
    }

    const derivedInsights = deriveInsights(records, spec);
    const result: RunResult = {
      runId,
      workflowId,
      status: process.env.CRUSTDATA_API_KEY ? "completed" : "mocked",
      createdAt: now,
      updatedAt: now,
      counts: {
        input: Math.max(spec.inputs.identifiers.length, spec.inputs.manualEntries.length, records.length),
        enriched: records.length,
        derived: records.length,
        failed: 0,
      },
      warnings,
      records,
      derivedInsights,
      uiModel: null,
    };

    result.uiModel = buildFallbackRunSpec(result);
    return result;
  } catch (error) {
    const result: RunResult = {
      runId,
      workflowId,
      status: "failed",
      createdAt: now,
      updatedAt: now,
      counts: {
        input: Math.max(spec.inputs.identifiers.length, spec.inputs.manualEntries.length, 0),
        enriched: 0,
        derived: 0,
        failed: 1,
      },
      warnings: [
        ...spec.warnings,
        error instanceof Error ? error.message : "Workflow execution failed.",
      ],
      records: [],
      derivedInsights: {
        title: "Workflow failed",
        summary: "The workflow could not complete. Review the warning panel and adjust identifiers or source mapping.",
        highlights: ["Execution stopped before any records were persisted."],
        recommendations: [
          "Provide domains, emails, or LinkedIn URLs when possible.",
          "Constrain the prompt to Company, Person, or CSV bootstrap workflows.",
        ],
        segments: [],
      },
      uiModel: null,
    };

    result.uiModel = buildFallbackRunSpec(result);
    return result;
  }
}

async function executeLiveWorkflow(client: CrustDataClient, spec: ValidatedWorkflowSpec) {
  if (spec.entityType === "person") {
    if (spec.inputMode === "person-search") {
      await maybeAutocomplete(client, spec);
      const searchResponse = await client.searchPeople(spec);
      const shortlist = normalizeArray(searchResponse).slice(0, spec.inputs.limit);
      const identifiers = shortlist
        .map((row) => row.professional_network_profile_url ?? row.linkedin_profile_url ?? row.business_email)
        .filter(isString);
      const enrichSpec = {
        ...spec,
        inputs: {
          ...spec.inputs,
          identifiers,
        },
      };
      return normalizePeople(await client.enrichPeople(enrichSpec));
    }

    return normalizePeople(await client.enrichPeople(spec));
  }

  if (spec.entityType === "company") {
    if (spec.inputMode === "company-search") {
      await maybeAutocomplete(client, spec);
      const searchResponse = await client.searchCompanies(spec);
      const shortlist = normalizeArray(searchResponse).slice(0, spec.inputs.limit);
      const identifiers = shortlist
        .map((row) => row.crustdata_company_id ?? row.domain ?? row.company_domain ?? row.name)
        .filter(isString)
        .map(String);
      const enrichSpec = {
        ...spec,
        inputs: {
          ...spec.inputs,
          identifiers,
        },
      };
      return normalizeCompanies(await client.enrichCompanies(enrichSpec));
    }

    return normalizeCompanies(await client.enrichCompanies(spec));
  }

  return buildMockRecords(spec, { latestRun: null, latestWorkflow: null, savedRuns: [], sourceContext: null });
}

async function maybeAutocomplete(client: CrustDataClient, spec: ValidatedWorkflowSpec) {
  if (!spec.inputs.filters) {
    return;
  }

  const filterText = JSON.stringify(spec.inputs.filters).toLowerCase();
  if (spec.entityType === "company" && filterText.includes("industry")) {
    await client.autocompleteCompanies("", spec.inputs.filters);
  }

  if (spec.entityType === "person" && filterText.includes("title")) {
    await client.autocompletePeople("", spec.inputs.filters);
  }
}

function normalizeCompanies(payload: unknown): RecordEnvelope[] {
  return normalizeArray(payload).map((entry) => {
    const companyData = asRecord(entry.company_data) ?? entry;
    const basicInfo = asRecord(companyData.basic_info);
    const taxonomy = asRecord(companyData.taxonomy);
    const headcount = asRecord(companyData.headcount);
    const funding = asRecord(companyData.funding_and_investment);
    const jobOpenings = asRecord(companyData.job_openings);
    const summary = firstString(
      basicInfo?.name,
      companyData.company_name,
      companyData.company_website_domain,
      companyData.company_website,
    ) ?? "Company";
    const industry = firstString(
      taxonomy?.professional_network_industry,
      taxonomy?.linkedin_industry,
      taxonomy?.linkedin_industries,
      basicInfo?.industries,
    ) ?? "Unknown";
    const headcountValue = firstString(
      headcount?.total,
      headcount?.linkedin_headcount,
      companyData.employee_count_range,
    ) ?? "n/a";
    return {
      entityType: "company",
      inputKey:
        String(
          entry.matched_on ??
            basicInfo?.domain ??
            companyData.company_website_domain ??
            basicInfo?.name ??
            companyData.company_name ??
            "company",
        ),
      sourceHint: "company-enrich",
      rawSourceJson: null,
      crustPayload: companyData,
      derivedPayload: {
        summary,
        industry,
        headcount: String(headcountValue),
        funding:
          firstString(
            funding?.crunchbase_total_investment_usd,
            companyData.total_investment_usd,
          ) ?? "n/a",
        hiring:
          firstString(
            jobOpenings?.job_openings_count,
          ) ?? "n/a",
        hqCountry: firstString(companyData.hq_country) ?? "Unknown",
      },
    };
  });
}

function normalizePeople(payload: unknown): RecordEnvelope[] {
  return normalizeArray(payload).map((entry) => {
    const personData = asRecord(entry.person_data) ?? entry;
    const basicProfile = asRecord(personData.basic_profile);
    const experience = asRecord(personData.experience);
    const employmentDetails = asRecord(experience?.employment_details);
    const current = asRecord(employmentDetails?.current);
    return {
      entityType: "person",
      inputKey:
        String(
          entry.matched_on ??
            basicProfile?.name ??
            personData.professional_network_profile_url ??
            "person",
        ),
      sourceHint: "person-enrich",
      rawSourceJson: null,
      crustPayload: personData,
      derivedPayload: {
        summary: String(basicProfile?.name ?? personData.name ?? "Person"),
        company: String(current?.company_name ?? current?.name ?? "Unknown"),
        title: String(current?.title ?? basicProfile?.headline ?? "Unknown"),
      },
    };
  });
}

function deriveInsights(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const titleBase =
    spec.entityType === "person" ? "People" : spec.entityType === "company" ? "Company" : "Workflow";

  const highlights = records
    .slice(0, 4)
    .map((record) => `${record.inputKey}: ${record.derivedPayload?.summary ?? "Enriched"}`);
  const recommendations = [
    `Refine the ${titleBase.toLowerCase()} shortlist with more specific filters in chat.`,
    "Export the current run or ask for a different UI shape such as a report or table-first view.",
  ];
  const segments = buildSegments(records, spec);

  return {
    title: `${titleBase} workflow`,
    summary:
      records.length > 0
        ? `Completed a ${spec.inputMode} workflow and prepared ${records.length} enriched records for ${spec.llmTask}.`
        : `Prepared the workflow structure, but no records were available after execution.`,
    highlights,
    recommendations,
    segments,
  };
}

function buildSegments(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  if (spec.entityType === "company") {
    const buckets = countBy(records, (record) => String(record.derivedPayload?.industry ?? "Unknown"));
    return Object.entries(buckets)
      .slice(0, 5)
      .map(([label, value]) => ({
        label,
        value: String(value),
        description: "company records",
      }));
  }

  if (spec.entityType === "person") {
    const buckets = countBy(records, (record) => String(record.derivedPayload?.company ?? "Unknown"));
    return Object.entries(buckets)
      .slice(0, 5)
      .map(([label, value]) => ({
        label,
        value: String(value),
        description: "profiles",
      }));
  }

  return [];
}

function buildMockRecords(spec: ValidatedWorkflowSpec, threadState: ThreadState): RecordEnvelope[] {
  const seedValues =
    spec.inputs.identifiers.length > 0
      ? spec.inputs.identifiers
      : spec.inputs.manualEntries.length > 0
        ? spec.inputs.manualEntries
        : threadState.sourceContext?.records.flatMap((row) => Object.values(row)).slice(0, spec.inputs.limit) ?? [];

  const base = seedValues.length > 0 ? seedValues : Array.from({ length: spec.inputs.limit }, (_, index) => `${spec.entityType}-${index + 1}`);

  return base.slice(0, spec.inputs.limit).map((value, index) => ({
    entityType: spec.entityType === "mixed" ? "company" : spec.entityType,
    inputKey: value,
    sourceHint: spec.sourceHints[0] ?? "mock-source",
    rawSourceJson: null,
    crustPayload:
      spec.entityType === "person"
        ? {
            basic_profile: { name: titleize(value) },
            experience: {
              employment_details: {
                current: {
                  company_name: `Company ${index + 1}`,
                  title: index % 2 === 0 ? "Senior Growth Lead" : "Head of Revenue",
                },
              },
            },
          }
        : {
            basic_info: {
              name: titleize(value.replace(/^https?:\/\//, "")),
              domain: value.includes(".") ? value : `sample${index + 1}.com`,
            },
            taxonomy: {
              professional_network_industry: index % 2 === 0 ? "Software" : "Financial Services",
            },
            headcount: { total: 50 + index * 25 },
          },
    derivedPayload:
      spec.entityType === "person"
        ? {
            summary: titleize(value),
            company: `Company ${index + 1}`,
            title: index % 2 === 0 ? "Senior Growth Lead" : "Head of Revenue",
            score: `${90 - index * 4}/100`,
          }
        : {
            summary: titleize(value),
            industry: index % 2 === 0 ? "Software" : "Financial Services",
            headcount: String(50 + index * 25),
            score: `${95 - index * 4}/100`,
          },
  }));
}

function normalizeArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.results)) {
    return record.results.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  if (Array.isArray(record.data)) {
    return record.data.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  if (Array.isArray(record.companies)) {
    return record.companies.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  if (Array.isArray(record.people)) {
    return record.people.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  return [];
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
