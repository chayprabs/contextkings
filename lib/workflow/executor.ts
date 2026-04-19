import { CrustDataClient } from "@/lib/crustdata/client";
import { buildFallbackRunSpec } from "@/lib/ui/specs";
import {
  type FilterCondition,
  type FilterGroup,
  type RecordEnvelope,
  type RunResult,
  type ThreadState,
  type ValidatedWorkflowSpec,
} from "@/lib/workflow/schema";

type UnknownRecord = Record<string, unknown>;

export async function runWorkflow(spec: ValidatedWorkflowSpec, threadState: ThreadState): Promise<RunResult> {
  const now = new Date().toISOString();
  const runId = `run-${crypto.randomUUID()}`;
  const workflowId = `workflow-${crypto.randomUUID()}`;

  try {
    let records: RecordEnvelope[];
    const warnings = [...spec.warnings];
    let status: RunResult["status"] = process.env.CRUSTDATA_API_KEY
      ? "completed"
      : "mocked";

    if (!process.env.CRUSTDATA_API_KEY) {
      records = buildMockRecords(spec, threadState);
      warnings.push("Live CrustData credentials are not configured, so the run was fulfilled with a realistic mock dataset.");
    } else {
      const client = new CrustDataClient(process.env.CRUSTDATA_API_KEY);
      records = await executeLiveWorkflow(client, spec);

      if (records.length === 0 && shouldUseSearchFallback(spec)) {
        records = buildMockRecords(spec, threadState);
        status = "partial";
        warnings.push(
          "Live search returned no records, so the workspace was hydrated with a labeled mock dataset to keep the workflow explorable.",
        );
      }
    }

    const derivedInsights = deriveInsights(records, spec);
    const result: RunResult = {
      runId,
      workflowId,
      status,
      createdAt: now,
      updatedAt: now,
      counts: {
        input: resolveInputCount(spec, records.length),
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
        input: resolveInputCount(spec, 0),
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
      const searchResponse = await client.searchPeople(expandSearchSpec(spec));
      const shortlist = normalizeArray(searchResponse).slice(0, expandedSearchLimit(spec));
      const identifiers = shortlist
        .map(extractPersonIdentifier)
        .filter(isString);
      if (identifiers.length === 0) {
        return finalizeRecords(normalizePeople(searchResponse), spec);
      }
      const enrichSpec = {
        ...spec,
        inputs: {
          ...spec.inputs,
          identifiers,
        },
      };
      const enriched = normalizePeople(await client.enrichPeople(enrichSpec));
      return finalizeRecords(
        enriched.length > 0 ? enriched : normalizePeople(searchResponse),
        spec,
      );
    }

    return finalizeRecords(normalizePeople(await client.enrichPeople(spec)), spec);
  }

  if (spec.entityType === "company") {
    if (spec.inputMode === "company-search") {
      await maybeAutocomplete(client, spec);
      const searchResponse = await client.searchCompanies(expandSearchSpec(spec));
      const shortlist = normalizeArray(searchResponse).slice(0, expandedSearchLimit(spec));
      const identifiers = shortlist
        .map(extractCompanyIdentifier)
        .filter(isString);
      if (identifiers.length === 0) {
        return finalizeRecords(normalizeCompanies(searchResponse), spec);
      }
      const enrichSpec = {
        ...spec,
        inputs: {
          ...spec.inputs,
          identifiers,
        },
      };
      const enriched = normalizeCompanies(await client.enrichCompanies(enrichSpec));
      return finalizeRecords(
        enriched.length > 0 ? enriched : normalizeCompanies(searchResponse),
        spec,
      );
    }

    return finalizeRecords(normalizeCompanies(await client.enrichCompanies(spec)), spec);
  }

  return finalizeRecords(
    buildMockRecords(spec, {
      latestRun: null,
      latestWorkflow: null,
      savedRuns: [],
      sourceContext: null,
    }),
    spec,
  );
}

async function maybeAutocomplete(client: CrustDataClient, spec: ValidatedWorkflowSpec) {
  void client;
  void spec;
}

function normalizeCompanies(payload: unknown): RecordEnvelope[] {
  return normalizeArray(payload).map((entry) => {
    const companyData = asRecord(entry.company_data) ?? entry;
    const basicInfo = asRecord(companyData.basic_info);
    const taxonomy = asRecord(companyData.taxonomy);
    const headcount = asRecord(companyData.headcount);
    const funding =
      asRecord(companyData.funding_and_investment) ?? asRecord(companyData.funding);
    const hiring =
      asRecord(companyData.job_openings) ?? asRecord(companyData.hiring);
    const locations = asRecord(companyData.locations);
    const summary = firstString(
      basicInfo?.name,
      companyData.company_name,
      basicInfo?.primary_domain,
      companyData.company_website_domain,
      companyData.company_website,
    ) ?? "Company";
    const industry = firstString(
      taxonomy?.professional_network_industry,
      taxonomy?.linkedin_industry,
      taxonomy?.linkedin_industries,
      taxonomy?.professional_network_industries,
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
            basicInfo?.primary_domain ??
            basicInfo?.domain ??
            companyData.company_website_domain ??
            basicInfo?.professional_network_url ??
            companyData.linkedin_profile_url ??
            basicInfo?.name ??
            companyData.company_name ??
            companyData.crustdata_company_id ??
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
            funding?.total_investment_usd,
            funding?.crunchbase_total_investment_usd,
            companyData.total_investment_usd,
          ) ?? "n/a",
        hiring:
          firstString(
            hiring?.openings_count,
            hiring?.job_openings_count,
          ) ?? "n/a",
        hqCountry:
          firstString(
            locations?.hq_country,
            companyData.hq_country,
            locations?.largest_headcount_country,
            companyData.largest_headcount_country,
            inferCountryFromHeadquarters(locations?.headquarters),
          ) ?? "Unknown",
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
  const title = summarizeGoal(spec.goal, spec.entityType);
  const titleBase =
    spec.entityType === "person"
      ? "candidate"
      : spec.entityType === "company"
        ? "company"
        : "workflow";

  const highlights = records
    .slice(0, 4)
    .map((record) => `${record.inputKey}: ${record.derivedPayload?.summary ?? "Enriched"}`);
  const recommendations = [
    `Refine the ${titleBase} shortlist with more specific filters in chat.`,
    "Export the current run or ask for a different UI shape such as a report or table-first view.",
  ];
  const segments = buildSegments(records, spec);

  return {
    title,
    summary:
      records.length > 0
        ? `Completed a ${spec.inputMode.replaceAll("-", " ")} workflow and prepared ${records.length} enriched records for ${spec.llmTask.replaceAll("-", " ")}.`
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

  if (Array.isArray(record.profiles)) {
    return record.profiles.map(asRecord).filter(Boolean) as UnknownRecord[];
  }

  return [];
}

function expandSearchSpec(spec: ValidatedWorkflowSpec): ValidatedWorkflowSpec {
  const nextLimit = expandedSearchLimit(spec);
  if (nextLimit === spec.inputs.limit) {
    return spec;
  }

  return {
    ...spec,
    inputs: {
      ...spec.inputs,
      limit: nextLimit,
    },
  };
}

function expandedSearchLimit(spec: ValidatedWorkflowSpec) {
  if (!spec.inputs.filters) {
    return spec.inputs.limit;
  }

  return Math.min(Math.max(spec.inputs.limit * 3, spec.inputs.limit), 25);
}

function finalizeRecords(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  return applyLocalFilters(records, spec.inputs.filters).slice(0, spec.inputs.limit);
}

function applyLocalFilters(
  records: RecordEnvelope[],
  filters?: FilterCondition | FilterGroup,
) {
  if (!filters) {
    return records;
  }

  return records.filter((record) => matchesFilter(record, filters));
}

function matchesFilter(
  record: RecordEnvelope,
  filter: FilterCondition | FilterGroup,
): boolean {
  if ("operator" in filter) {
    return filter.operator === "and"
      ? filter.conditions.every((condition) => matchesFilter(record, condition))
      : filter.conditions.some((condition) => matchesFilter(record, condition));
  }

  const values = extractFilterValues(record, filter.field);
  if (values.length === 0) {
    return false;
  }

  switch (filter.type) {
    case "=":
      return values.some((value) => valueEquals(value, filter.value));
    case "contains":
      return values.some((value) => valueContains(value, filter.value));
    case "in":
      return values.some((value) => valueIn(value, filter.value));
    case ">=":
    case "=>":
      return values.some((value) => numericCompare(value, filter.value, "gte"));
    case "<=":
    case "=<":
      return values.some((value) => numericCompare(value, filter.value, "lte"));
    default:
      return false;
  }
}

function extractFilterValues(record: RecordEnvelope, field: string) {
  const payload = asRecord(record.crustPayload) ?? {};
  const derived = asRecord(record.derivedPayload) ?? {};

  switch (field) {
    case "taxonomy.professional_network_industry":
      return candidateValues([
        getNestedValue(payload, ["taxonomy", "professional_network_industry"]),
        getNestedValue(payload, ["taxonomy", "linkedin_industry"]),
        getNestedValue(payload, ["taxonomy", "linkedin_industries"]),
        getNestedValue(payload, ["taxonomy", "professional_network_industries"]),
        derived.industry,
      ]);
    case "funding.last_round_type":
      return candidateValues([
        getNestedValue(payload, ["funding", "last_round_type"]),
        getNestedValue(payload, ["funding_and_investment", "last_funding_round_type"]),
      ]);
    case "headcount.total":
      return candidateValues([
        getNestedValue(payload, ["headcount", "total"]),
        getNestedValue(payload, ["headcount", "linkedin_headcount"]),
        derived.headcount,
      ]);
    case "hiring.openings_count":
    case "job_openings.job_openings_count":
      return candidateValues([
        getNestedValue(payload, ["hiring", "openings_count"]),
        getNestedValue(payload, ["job_openings", "job_openings_count"]),
        derived.hiring,
      ]);
    case "hq_country":
    case "locations.hq_country":
    case "largest_headcount_country":
    case "locations.largest_headcount_country":
      return candidateValues([
        getNestedValue(payload, ["locations", "hq_country"]),
        payload.hq_country,
        getNestedValue(payload, ["locations", "largest_headcount_country"]),
        payload.largest_headcount_country,
        inferCountryFromHeadquarters(getNestedValue(payload, ["locations", "headquarters"])),
        derived.hqCountry,
      ]);
    case "experience.employment_details.current.title":
      return candidateValues([
        getNestedValue(payload, ["experience", "employment_details", "current", "title"]),
        derived.title,
      ]);
    default:
      return candidateValues([
        getValueByPath(payload, field),
        getValueByPath(derived, field),
      ]);
  }
}

function candidateValues(values: unknown[]) {
  return values
    .flatMap(flattenCandidateValue)
    .filter(
      (value): value is string | number | boolean =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    );
}

function flattenCandidateValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenCandidateValue);
  }

  if (value == null) {
    return [];
  }

  return [value];
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;

  for (const segment of path) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[segment];
  }

  return current;
}

function getValueByPath(value: unknown, path: string): unknown {
  return getNestedValue(value, path.split("."));
}

function valueEquals(
  candidate: string | number | boolean,
  expected: FilterCondition["value"],
): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => valueEquals(candidate, value));
  }

  return normalizeScalar(candidate) === normalizeScalar(expected);
}

function valueContains(
  candidate: string | number | boolean,
  expected: FilterCondition["value"],
): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => valueContains(candidate, value));
  }

  return String(candidate).toLowerCase().includes(String(expected).toLowerCase());
}

function valueIn(
  candidate: string | number | boolean,
  expected: FilterCondition["value"],
) {
  if (!Array.isArray(expected)) {
    return valueEquals(candidate, expected);
  }

  return expected.some((value) => valueEquals(candidate, value));
}

function numericCompare(
  candidate: string | number | boolean,
  expected: FilterCondition["value"],
  operator: "gte" | "lte",
) {
  if (Array.isArray(expected)) {
    return false;
  }

  const candidateNumber = toNumber(candidate);
  const expectedNumber = toNumber(expected);
  if (candidateNumber == null || expectedNumber == null) {
    return false;
  }

  return operator === "gte"
    ? candidateNumber >= expectedNumber
    : candidateNumber <= expectedNumber;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeScalar(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : String(value).toLowerCase();
}

function inferCountryFromHeadquarters(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const segments = value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.at(-1) ?? null;
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

function resolveInputCount(spec: ValidatedWorkflowSpec, recordsLength: number) {
  const explicitInputs = Math.max(
    spec.inputs.identifiers.length,
    spec.inputs.manualEntries.length,
  );

  return explicitInputs > 0 ? explicitInputs : recordsLength;
}

function summarizeGoal(goal: string, entityType: ValidatedWorkflowSpec["entityType"]) {
  const cleaned = goal.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return entityType === "person" ? "Candidate research" : "Company research";
  }

  const normalized = cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractCompanyIdentifier(row: UnknownRecord) {
  const basicInfo = asRecord(row.basic_info);

  return firstString(
    row.crustdata_company_id,
    basicInfo?.primary_domain,
    row.company_website_domain,
    row.domain,
    basicInfo?.domain,
    basicInfo?.professional_network_url,
    row.linkedin_profile_url,
    row.company_name,
    basicInfo?.name,
  );
}

function extractPersonIdentifier(row: UnknownRecord) {
  const basicProfile = asRecord(row.basic_profile);

  return firstString(
    row.professional_network_profile_url,
    row.linkedin_profile_url,
    row.business_email,
    row.work_email,
    basicProfile?.linkedin_profile_url,
  );
}

function shouldUseSearchFallback(spec: ValidatedWorkflowSpec) {
  return (
    (spec.inputMode === "company-search" || spec.inputMode === "person-search") &&
    spec.inputs.identifiers.length === 0 &&
    spec.inputs.manualEntries.length === 0
  );
}
