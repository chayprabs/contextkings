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
    const name = firstString(
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
    const domain = firstString(
      basicInfo?.primary_domain,
      basicInfo?.domain,
      companyData.company_website_domain,
      companyData.domain,
    );
    const website = firstString(
      basicInfo?.company_website,
      basicInfo?.website,
      companyData.company_website,
    );
    const linkedinUrl = firstString(
      basicInfo?.professional_network_url,
      companyData.linkedin_profile_url,
    );
    const headcountValue = firstNumber(
      headcount?.total,
      headcount?.linkedin_headcount,
      companyData.employee_count_range,
    );
    const fundingValue = firstNumber(
      funding?.total_investment_usd,
      funding?.crunchbase_total_investment_usd,
      companyData.total_investment_usd,
    );
    const fundingStage = firstString(
      funding?.last_round_type,
      funding?.last_funding_round_type,
      funding?.crunchbase_last_funding_round_type,
      companyData.last_round_type,
      companyData.last_funding_round_type,
    ) ?? "Unknown";
    const hiringValue = firstNumber(
      hiring?.openings_count,
      hiring?.job_openings_count,
    );
    const headquarters =
      firstString(
        locations?.headquarters,
        companyData.headquarters,
        companyData.hq_location,
      ) ?? buildHeadquartersLabel(companyData);
    const hqCountry =
      firstString(
        locations?.hq_country,
        companyData.hq_country,
        locations?.largest_headcount_country,
        companyData.largest_headcount_country,
        inferCountryFromHeadquarters(locations?.headquarters),
      ) ?? "Unknown";

    return {
      entityType: "company",
      inputKey:
        String(
          entry.matched_on ??
            domain ??
            linkedinUrl ??
            name ??
            companyData.crustdata_company_id ??
            "company",
        ),
      sourceHint: entry.company_data ? "company-enrich" : "company-search",
      rawSourceJson: null,
      crustPayload: companyData,
      derivedPayload: {
        name,
        summary: buildCompanyRecordSummary({
          name,
          industry,
          headquarters,
          hqCountry,
          fundingStage,
          hiringValue,
          headcountValue,
        }),
        domain: domain ?? "n/a",
        website: website ?? "n/a",
        linkedinUrl: linkedinUrl ?? "n/a",
        industry,
        headcount: headcountValue == null ? "n/a" : formatWholeNumber(headcountValue),
        headcountValue: headcountValue ?? undefined,
        funding: fundingValue == null ? "n/a" : formatUsd(fundingValue),
        fundingValue: fundingValue ?? undefined,
        fundingStage,
        hiring: hiringValue == null ? "n/a" : String(hiringValue),
        hiringValue: hiringValue ?? undefined,
        hq: headquarters ?? hqCountry,
        hqCountry,
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
    const contact = asRecord(personData.contact);
    const name = firstString(
      basicProfile?.name,
      personData.name,
      entry.matched_on,
    ) ?? "Person";
    const company = firstString(
      current?.company_name,
      current?.name,
      personData.company_name,
    ) ?? "Unknown";
    const title = firstString(
      current?.title,
      basicProfile?.headline,
      personData.title,
    ) ?? "Unknown";
    const location =
      firstString(
        basicProfile?.location,
        current?.location,
        contact?.city,
      ) ?? buildPersonLocation(personData, basicProfile, current, contact);
    const email = firstString(
      personData.business_email,
      personData.work_email,
      contact?.business_email,
      contact?.work_email,
    );
    const linkedinUrl = firstString(
      personData.professional_network_profile_url,
      personData.linkedin_profile_url,
      basicProfile?.linkedin_profile_url,
    );
    const headline = firstString(basicProfile?.headline, personData.headline);

    return {
      entityType: "person",
      inputKey:
        String(
          entry.matched_on ??
            linkedinUrl ??
            email ??
            name ??
            "person",
        ),
      sourceHint: entry.person_data ? "person-enrich" : "person-search",
      rawSourceJson: null,
      crustPayload: personData,
      derivedPayload: {
        name,
        summary: buildPersonRecordSummary({
          name,
          title,
          company,
          location,
          email,
        }),
        company,
        title,
        location: location ?? "Unknown",
        email: email ?? "n/a",
        linkedinUrl: linkedinUrl ?? "n/a",
        headline: headline ?? "n/a",
      },
    };
  });
}

function deriveInsights(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const title = summarizeGoal(spec.goal, spec.entityType);
  const segments = buildSegments(records, spec);

  return {
    title,
    summary:
      records.length > 0
        ? spec.entityType === "person"
          ? buildPersonRunSummary(records, spec)
          : buildCompanyRunSummary(records, spec)
        : `Prepared the workflow structure, but no records were available after execution.`,
    highlights:
      spec.entityType === "person"
        ? buildPersonHighlights(records)
        : buildCompanyHighlights(records),
    recommendations: buildRecommendations(records, spec),
    segments,
  };
}

function buildSegments(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const candidates =
    spec.entityType === "person"
      ? [
          { key: "company", description: "profiles by current company" },
          { key: "title", description: "profiles by current title" },
          { key: "location", description: "profiles by location" },
        ]
      : [
          { key: "hqCountry", description: "companies by headquarters country" },
          { key: "industry", description: "companies by industry" },
          { key: "fundingStage", description: "companies by funding stage" },
        ];
  const selected = candidates
    .map((candidate) => ({
      ...candidate,
      buckets: collectDerivedValueBuckets(records, candidate.key),
    }))
    .find((candidate) => Object.keys(candidate.buckets).length > 1)
    ?? candidates
      .map((candidate) => ({
        ...candidate,
        buckets: collectDerivedValueBuckets(records, candidate.key),
      }))
      .find((candidate) => Object.keys(candidate.buckets).length > 0);

  if (!selected) {
    return [];
  }

  return Object.entries(selected.buckets)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value: String(value),
      description: selected.description,
    }));
}

function buildMockRecords(spec: ValidatedWorkflowSpec, threadState: ThreadState): RecordEnvelope[] {
  const seedValues =
    spec.inputs.identifiers.length > 0
      ? spec.inputs.identifiers
      : spec.inputs.manualEntries.length > 0
        ? spec.inputs.manualEntries
        : threadState.sourceContext?.records.flatMap((row) => Object.values(row)).slice(0, spec.inputs.limit) ?? [];
  const mockSourceHint = buildMockSourceHint(spec.sourceHints[0]);
  const usesSyntheticSeeds = seedValues.length === 0;
  const base = seedValues.length > 0
    ? seedValues
    : Array.from({ length: spec.inputs.limit }, (_, index) => `synthetic-${spec.entityType}-${index + 1}`);

  if (spec.entityType === "person") {
    return normalizePeople(
      base.slice(0, spec.inputs.limit).map((value, index) => ({
        matched_on: usesSyntheticSeeds
          ? buildSyntheticPersonName(index)
          : value,
        person_data: {
          basic_profile: {
            name: usesSyntheticSeeds
              ? buildSyntheticPersonName(index)
              : buildMockPersonName(value, index),
            headline: index % 2 === 0 ? "Senior Growth Lead" : "Head of Revenue",
            location: index % 2 === 0 ? "Bengaluru, India" : "San Francisco, USA",
          },
          professional_network_profile_url: `https://linkedin.example/in/${slugifyLabel(
            usesSyntheticSeeds ? buildSyntheticPersonName(index) : buildMockPersonName(value, index),
          )}`,
          business_email: `${slugifyLabel(
            usesSyntheticSeeds ? buildSyntheticPersonName(index) : buildMockPersonName(value, index),
          )}@example.com`,
          experience: {
            employment_details: {
              current: {
                company_name: buildSyntheticCompanyName(
                  readCompanyMockContext(spec.inputs.filters),
                  index,
                ),
                title: index % 2 === 0 ? "Senior Growth Lead" : "Head of Revenue",
              },
            },
          },
        },
      })),
    ).map((record) => ({
      ...record,
      sourceHint: mockSourceHint,
    }));
  }

  const companyMockContext = readCompanyMockContext(spec.inputs.filters);

  return normalizeCompanies(
    base.slice(0, spec.inputs.limit).map((value, index) => ({
      matched_on: usesSyntheticSeeds
        ? buildSyntheticCompanyName(companyMockContext, index)
        : value,
      company_data: {
        basic_info: {
          name: usesSyntheticSeeds
            ? buildSyntheticCompanyName(companyMockContext, index)
            : buildMockCompanyName(value, index),
          primary_domain: buildMockCompanyDomain(
            usesSyntheticSeeds
              ? buildSyntheticCompanyName(companyMockContext, index)
              : buildMockCompanyName(value, index),
            value,
          ),
          professional_network_url: `https://linkedin.example/company/${slugifyLabel(
            usesSyntheticSeeds
              ? buildSyntheticCompanyName(companyMockContext, index)
              : buildMockCompanyName(value, index),
          )}`,
        },
        taxonomy: {
          professional_network_industry:
            companyMockContext.industry ??
            (index % 2 === 0 ? "Software" : "Financial Services"),
        },
        headcount: { total: 50 + index * 25 },
        funding: {
          total_investment_usd: 2_000_000 + index * 1_250_000,
          last_round_type:
            companyMockContext.fundingStage ??
            (index % 3 === 0 ? "Seed" : index % 3 === 1 ? "Series A" : "Series B"),
        },
        hiring: { openings_count: 2 + index * 2 },
        locations: buildMockCompanyLocation(companyMockContext, index),
      },
    })),
  ).map((record) => ({
    ...record,
    sourceHint: mockSourceHint,
  }));
}

function buildCompanyRecordSummary(input: {
  name: string;
  industry: string;
  headquarters: string | null;
  hqCountry: string;
  fundingStage: string;
  hiringValue: number | null;
  headcountValue: number | null;
}) {
  const parts = [
    input.industry !== "Unknown" ? input.industry : null,
    input.headquarters ?? (input.hqCountry !== "Unknown" ? input.hqCountry : null),
    input.fundingStage !== "Unknown" ? input.fundingStage : null,
    input.hiringValue && input.hiringValue > 0 ? `${input.hiringValue} open role${input.hiringValue === 1 ? "" : "s"}` : null,
    input.headcountValue ? `${formatWholeNumber(input.headcountValue)} employees` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${input.name} | ${parts.join(" | ")}` : input.name;
}

function buildPersonRecordSummary(input: {
  name: string;
  title: string;
  company: string;
  location: string | null;
  email: string | null;
}) {
  const roleText =
    input.title !== "Unknown" && input.company !== "Unknown"
      ? `${input.title} at ${input.company}`
      : input.title !== "Unknown"
        ? input.title
        : input.company !== "Unknown"
          ? input.company
          : null;
  const parts = [
    roleText,
    input.location,
    input.email ? "contact available" : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${input.name} | ${parts.join(" | ")}` : input.name;
}

function buildCompanyRunSummary(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const industries = topDerivedLabels(records, "industry", 2);
  const countries = topDerivedLabels(records, "hqCountry", 2);
  const hiringCount = records.filter((record) => readDerivedNumber(record, "hiringValue", "hiring") > 0).length;
  const fundingStageCount = records.filter((record) => hasMeaningfulDerivedValue(record, "fundingStage")).length;
  const parts = [
    `Prepared ${records.length} company record${records.length === 1 ? "" : "s"} for ${spec.llmTask.replaceAll("-", " ")}.`,
    industries.length > 0 ? `Coverage is strongest in ${joinLabels(industries)}.` : null,
    countries.length > 0 ? `HQ concentration is ${joinLabels(countries)}.` : null,
    hiringCount > 0
      ? `${hiringCount} compan${hiringCount === 1 ? "y" : "ies"} show open-role activity.`
      : fundingStageCount > 0
        ? `${fundingStageCount} compan${fundingStageCount === 1 ? "y" : "ies"} include funding-stage data.`
        : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function buildPersonRunSummary(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const titles = topDerivedLabels(records, "title", 2);
  const companies = topDerivedLabels(records, "company", 2);
  const locations = topDerivedLabels(records, "location", 2);
  const contactCount = records.filter((record) => hasMeaningfulDerivedValue(record, "email")).length;
  const parts = [
    `Prepared ${records.length} candidate record${records.length === 1 ? "" : "s"} for ${spec.llmTask.replaceAll("-", " ")}.`,
    titles.length > 0 ? `The strongest role coverage is ${joinLabels(titles)}.` : null,
    companies.length > 0 ? `Current-company coverage is ${joinLabels(companies)}.` : null,
    locations.length > 0 ? `Location coverage is ${joinLabels(locations)}.` : null,
    contactCount > 0 ? `${contactCount} profile${contactCount === 1 ? "" : "s"} include direct contact fields.` : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function buildCompanyHighlights(records: RecordEnvelope[]) {
  return [...records]
    .sort((left, right) => companyPriorityScore(right) - companyPriorityScore(left))
    .slice(0, 4)
    .map((record) => {
      const name = readDerivedText(record, "name") ?? record.inputKey;
      const details = [
        readDerivedText(record, "industry"),
        readDerivedText(record, "hqCountry") ?? readDerivedText(record, "hq"),
        normalizeDerivedText(readDerivedText(record, "fundingStage")),
        readDerivedNumber(record, "hiringValue", "hiring") > 0
          ? `${readDerivedNumber(record, "hiringValue", "hiring")} openings`
          : null,
        normalizeDerivedText(readDerivedText(record, "headcount")),
      ].filter(Boolean);

      return details.length > 0 ? `${name} | ${details.join(" | ")}` : name;
    });
}

function buildPersonHighlights(records: RecordEnvelope[]) {
  return [...records]
    .sort((left, right) => personPriorityScore(right) - personPriorityScore(left))
    .slice(0, 4)
    .map((record) => {
      const name = readDerivedText(record, "name") ?? record.inputKey;
      const title = normalizeDerivedText(readDerivedText(record, "title"));
      const company = normalizeDerivedText(readDerivedText(record, "company"));
      const location = normalizeDerivedText(readDerivedText(record, "location"));
      const email = hasMeaningfulDerivedValue(record, "email") ? "contact available" : null;
      const role = title && company ? `${title} at ${company}` : title ?? company;
      const details = [role, location, email].filter(Boolean);

      return details.length > 0 ? `${name} | ${details.join(" | ")}` : name;
    });
}

function buildRecommendations(records: RecordEnvelope[], spec: ValidatedWorkflowSpec) {
  const recommendations: string[] = [];

  if (records.length === spec.inputs.limit) {
    recommendations.push(
      `The current limit returned ${records.length} records. Increase the limit if you want a broader shortlist.`,
    );
  }

  if (spec.entityType === "person") {
    const missingLocationCount = records.filter((record) => !hasMeaningfulDerivedValue(record, "location")).length;
    const contactCount = records.filter((record) => hasMeaningfulDerivedValue(record, "email")).length;

    if (contactCount === 0) {
      recommendations.push("No profiles exposed direct contact fields. Use profile URLs or business emails when outreach data matters.");
    } else if (missingLocationCount > 0) {
      recommendations.push(`${missingLocationCount} profile${missingLocationCount === 1 ? "" : "s"} are missing clear location data. Add location filters if geography is critical.`);
    }
  } else {
    const missingHqCount = records.filter((record) => !hasMeaningfulDerivedValue(record, "hqCountry")).length;
    const topCountry = topDerivedLabels(records, "hqCountry", 1)[0];

    if (topCountry && distinctDerivedValueCount(records, "hqCountry") > 1) {
      recommendations.push(`Add or tighten an HQ-country filter if you want to focus the list around ${topCountry}.`);
    }

    if (missingHqCount > 0) {
      recommendations.push(`${missingHqCount} compan${missingHqCount === 1 ? "y is" : "ies are"} missing clear HQ metadata. Direct domains usually return better location coverage.`);
    }
  }

  recommendations.push("Export the current records or refine the workflow with a narrower brief if you want a more opinionated report.");
  return recommendations.slice(0, 3);
}

function collectDerivedValueBuckets(records: RecordEnvelope[], key: string) {
  const buckets: Record<string, number> = {};

  for (const record of records) {
    const value = normalizeDerivedText(readDerivedText(record, key));
    if (!value) {
      continue;
    }

    buckets[value] = (buckets[value] ?? 0) + 1;
  }

  return buckets;
}

function topDerivedLabels(records: RecordEnvelope[], key: string, limit: number) {
  return Object.entries(collectDerivedValueBuckets(records, key))
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function distinctDerivedValueCount(records: RecordEnvelope[], key: string) {
  return topDerivedLabels(records, key, records.length).length;
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function readDerivedText(record: RecordEnvelope, key: string) {
  const derived = asRecord(record.derivedPayload);
  return derived ? firstString(derived[key]) : null;
}

function normalizeDerivedText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return !normalized || normalized === "n/a" || normalized === "Unknown"
    ? null
    : normalized;
}

function hasMeaningfulDerivedValue(record: RecordEnvelope, key: string) {
  return Boolean(normalizeDerivedText(readDerivedText(record, key)));
}

function readDerivedNumber(record: RecordEnvelope, numericKey: string, fallbackKey?: string) {
  const derived = asRecord(record.derivedPayload);
  const numeric = derived ? toNumber(derived[numericKey]) : null;
  if (numeric != null) {
    return numeric;
  }

  return fallbackKey && derived ? toNumber(derived[fallbackKey]) ?? 0 : 0;
}

function companyPriorityScore(record: RecordEnvelope) {
  return (
    readDerivedNumber(record, "hiringValue", "hiring") * 1000 +
    readDerivedNumber(record, "fundingValue", "funding") +
    readDerivedNumber(record, "headcountValue", "headcount")
  );
}

function personPriorityScore(record: RecordEnvelope) {
  const title = (readDerivedText(record, "title") ?? "").toLowerCase();
  const seniorityBonus =
    title.includes("head") || title.includes("director") || title.includes("lead")
      ? 200
      : title.includes("senior") || title.includes("staff")
        ? 120
        : 40;

  return seniorityBonus + (hasMeaningfulDerivedValue(record, "email") ? 80 : 0);
}

function buildHeadquartersLabel(companyData: UnknownRecord) {
  const city = firstString(companyData.hq_city);
  const region = firstString(companyData.hq_region, companyData.hq_state);
  const country = firstString(companyData.hq_country);
  return [city, region, country].filter(Boolean).join(", ") || null;
}

function buildPersonLocation(
  personData: UnknownRecord,
  basicProfile: UnknownRecord | null,
  current: UnknownRecord | null,
  contact: UnknownRecord | null,
) {
  const direct = firstString(
    personData.location,
    basicProfile?.city,
    current?.location_city,
    contact?.location,
  );
  if (direct) {
    return direct;
  }

  const city = firstString(basicProfile?.city, current?.city, contact?.city);
  const region = firstString(basicProfile?.state, current?.state, contact?.state);
  const country = firstString(basicProfile?.country, current?.country, contact?.country);

  return [city, region, country].filter(Boolean).join(", ") || null;
}

function readCompanyMockContext(filters?: FilterCondition | FilterGroup) {
  const conditions = flattenFilterConditions(filters);

  return {
    industry: readStringFilterValue(
      conditions,
      "taxonomy.professional_network_industry",
    ),
    fundingStage: readStringFilterValue(conditions, "funding.last_round_type"),
    hqCountry:
      readStringFilterValue(conditions, "hq_country") ??
      readStringFilterValue(conditions, "locations.hq_country"),
  };
}

function flattenFilterConditions(
  filters?: FilterCondition | FilterGroup,
): FilterCondition[] {
  if (!filters) {
    return [];
  }

  if ("field" in filters) {
    return [filters];
  }

  return filters.conditions.flatMap((condition) =>
    flattenFilterConditions(condition),
  );
}

function readStringFilterValue(
  conditions: FilterCondition[],
  field: string,
) {
  const match = conditions.find((condition) => condition.field === field);
  if (!match) {
    return null;
  }

  return typeof match.value === "string" ? match.value : null;
}

function buildMockSourceHint(sourceHint?: string) {
  if (!sourceHint) {
    return "mock dataset";
  }

  return sourceHint.toLowerCase().includes("mock")
    ? sourceHint
    : `${sourceHint} (mock)`;
}

function buildSyntheticCompanyName(
  context: {
    industry: string | null;
    fundingStage: string | null;
    hqCountry: string | null;
  },
  index: number,
) {
  const pool = selectCompanySuffixPool(context.industry);
  const prefix = MOCK_COMPANY_PREFIXES[index % MOCK_COMPANY_PREFIXES.length];
  const suffix = pool[Math.floor(index / MOCK_COMPANY_PREFIXES.length) % pool.length];
  const qualifier = buildMockCompanyQualifier(context, index);

  return [prefix, suffix, qualifier].filter(Boolean).join(" ");
}

function buildSyntheticPersonName(index: number) {
  const first = MOCK_PERSON_FIRST_NAMES[index % MOCK_PERSON_FIRST_NAMES.length];
  const last =
    MOCK_PERSON_LAST_NAMES[Math.floor(index / MOCK_PERSON_FIRST_NAMES.length) % MOCK_PERSON_LAST_NAMES.length];

  return `${first} ${last}`;
}

function buildMockCompanyQualifier(
  context: {
    industry: string | null;
    fundingStage: string | null;
    hqCountry: string | null;
  },
  index: number,
) {
  const labels = [
    context.hqCountry ? MOCK_COUNTRY_LABELS[context.hqCountry] ?? null : null,
    context.fundingStage && index >= MOCK_COMPANY_PREFIXES.length
      ? context.fundingStage.replace(/\s+/g, "")
      : null,
  ].filter(Boolean);

  return labels.join(" ");
}

function selectCompanySuffixPool(industry: string | null) {
  switch ((industry ?? "").toLowerCase()) {
    case "financial services":
      return MOCK_COMPANY_SUFFIXES.financialServices;
    case "artificial intelligence":
      return MOCK_COMPANY_SUFFIXES.artificialIntelligence;
    case "hospital & health care":
      return MOCK_COMPANY_SUFFIXES.healthcare;
    case "retail":
      return MOCK_COMPANY_SUFFIXES.retail;
    case "software":
    case "information technology & services":
      return MOCK_COMPANY_SUFFIXES.software;
    default:
      return MOCK_COMPANY_SUFFIXES.default;
  }
}

function buildMockCompanyDomain(name: string, fallbackValue: string) {
  if (fallbackValue.includes(".")) {
    return fallbackValue
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }

  return `${slugifyLabel(name)}.example`;
}

function buildMockCompanyLocation(
  context: {
    industry: string | null;
    fundingStage: string | null;
    hqCountry: string | null;
  },
  index: number,
) {
  const locationByCountry = context.hqCountry
    ? MOCK_HQ_LOCATIONS[context.hqCountry]
    : null;

  if (locationByCountry) {
    return locationByCountry;
  }

  return index % 2 === 0
    ? {
        headquarters: "Bengaluru, Karnataka, India",
        hq_country: "India",
      }
    : {
        headquarters: "New York, New York, USA",
        hq_country: "USA",
      };
}

function buildMockCompanyName(value: string, index: number) {
  const normalized = value.replace(/^https?:\/\//, "").split(/[/.]/)[0];
  return titleize(normalized || `company ${index + 1}`);
}

function buildMockPersonName(value: string, index: number) {
  const emailName = value.includes("@") ? value.split("@")[0] : value;
  return titleize(emailName || `person ${index + 1}`);
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = toNumber(value);
      if (parsed != null) {
        return parsed;
      }

       const rangedMatch = value.match(/-?\d[\d,]*/);
       if (rangedMatch) {
         const rangedValue = toNumber(rangedMatch[0]);
         if (rangedValue != null) {
           return rangedValue;
         }
       }
    }
  }

  return null;
}

function formatUsd(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }

  return `$${Math.round(value)}`;
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function dedupeRecords(records: RecordEnvelope[]) {
  const deduped = new Map<string, RecordEnvelope>();

  for (const record of records) {
    const key =
      readDerivedText(record, "linkedinUrl") ??
      readDerivedText(record, "domain") ??
      readDerivedText(record, "email") ??
      readDerivedText(record, "name") ??
      record.inputKey;

    if (!deduped.has(key)) {
      deduped.set(key, record);
    }
  }

  return [...deduped.values()];
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
  return dedupeRecords(applyLocalFilters(records, spec.inputs.filters)).slice(0, spec.inputs.limit);
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

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugifyLabel(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mock-record";
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

const MOCK_COMPANY_PREFIXES = [
  "Northstar",
  "Signal",
  "Summit",
  "Cinder",
  "Harbor",
  "Atlas",
  "Meridian",
  "Brightpath",
] as const;

const MOCK_COMPANY_SUFFIXES = {
  default: [
    "Works",
    "Collective",
    "Labs",
    "Group",
    "Studio",
    "Partners",
  ],
  software: [
    "Stack",
    "Forge",
    "Cloud",
    "Systems",
    "Flow",
    "Works",
  ],
  financialServices: [
    "Ledger",
    "Capital",
    "Treasury",
    "Pay",
    "Vault",
    "Finance",
  ],
  artificialIntelligence: [
    "Intelligence",
    "Neural",
    "Compute",
    "Labs",
    "Vector",
    "Signals",
  ],
  healthcare: [
    "Health",
    "Care",
    "Bio",
    "Med",
    "Clinic",
    "Wellness",
  ],
  retail: [
    "Commerce",
    "Market",
    "Supply",
    "Retail",
    "Cart",
    "Merch",
  ],
} as const;

const MOCK_PERSON_FIRST_NAMES = [
  "Avery",
  "Jordan",
  "Riley",
  "Taylor",
  "Morgan",
  "Casey",
  "Parker",
  "Quinn",
] as const;

const MOCK_PERSON_LAST_NAMES = [
  "Shaw",
  "Patel",
  "Kim",
  "Reed",
  "Flores",
  "Singh",
  "Cole",
  "Nguyen",
] as const;

const MOCK_HQ_LOCATIONS: Record<string, { headquarters: string; hq_country: string }> = {
  India: {
    headquarters: "Bengaluru, Karnataka, India",
    hq_country: "India",
  },
  USA: {
    headquarters: "New York, New York, USA",
    hq_country: "USA",
  },
  "United Kingdom": {
    headquarters: "London, England, United Kingdom",
    hq_country: "United Kingdom",
  },
  Canada: {
    headquarters: "Toronto, Ontario, Canada",
    hq_country: "Canada",
  },
  Singapore: {
    headquarters: "Singapore",
    hq_country: "Singapore",
  },
  Europe: {
    headquarters: "Berlin, Germany",
    hq_country: "Europe",
  },
  "United Arab Emirates": {
    headquarters: "Dubai, United Arab Emirates",
    hq_country: "United Arab Emirates",
  },
};

const MOCK_COUNTRY_LABELS: Record<string, string> = {
  India: "India",
  USA: "US",
  "United Kingdom": "UK",
  Canada: "CA",
  Singapore: "SG",
  Europe: "EU",
  "United Arab Emirates": "UAE",
};
