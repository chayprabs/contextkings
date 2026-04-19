import type { FilterCondition, FilterGroup, ValidatedWorkflowSpec } from "@/lib/workflow/schema";

const BASE_URL = "https://api.crustdata.com";
const COMPANY_SCREENER_FIELDS = [
  "crustdata_company_id",
  "company_name",
  "company_website",
  "company_website_domain",
  "hq_country",
  "employee_count_range",
  "linkedin_profile_url",
  "taxonomy.linkedin_industries",
  "headcount.linkedin_headcount",
  "funding_and_investment.crunchbase_total_investment_usd",
  "funding_and_investment.last_funding_round_type",
  "job_openings.job_openings_count",
];
const COMPANY_ENRICH_FIELDS = [
  "basic_info",
  "headcount",
  "funding",
  "hiring",
  "locations",
  "taxonomy",
];
const COMPANY_SEARCH_FIELDS = [
  "crustdata_company_id",
  "basic_info.name",
  "basic_info.primary_domain",
  "basic_info.professional_network_url",
  "taxonomy.professional_network_industry",
  "headcount.total",
  "funding.total_investment_usd",
];
const SUPPORTED_COMPANY_SEARCH_FILTER_FIELDS = new Set([
  "taxonomy.professional_network_industry",
  "funding.last_round_type",
  "headcount.total",
]);
const SUPPORTED_PERSON_SEARCH_FILTER_FIELDS = new Set([
  "experience.employment_details.current.title",
]);

export class CrustDataClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiVersion = process.env.CRUSTDATA_API_VERSION ?? "2025-11-01",
  ) {}

  async enrichCompanies(spec: ValidatedWorkflowSpec) {
    const identifiers = dedupe(spec.inputs.identifiers);
    if (identifiers.length === 0) {
      return [];
    }

    const crustdataCompanyIds = identifiers
      .filter(isNumericId)
      .map((value) => Number(value));
    const domains = identifiers.filter(isDomain);
    const profileUrls = identifiers.filter(isCompanyProfileUrl);
    const names = identifiers.filter(
      (value) => !isDomain(value) && !isCompanyProfileUrl(value) && !isNumericId(value),
    );
    const responses: unknown[] = [];
    const fallbackResponses: unknown[] = [];

    if (crustdataCompanyIds.length > 0) {
      responses.push(
        await this.post("/company/enrich", {
          crustdata_company_ids: crustdataCompanyIds,
          fields: COMPANY_ENRICH_FIELDS,
        }),
      );
    }

    if (domains.length > 0) {
      const payload = await this.get("/screener/company", {
        company_domain: domains.join(","),
        fields: COMPANY_SCREENER_FIELDS.join(","),
      });
      const exactMatches = filterExactCompanyMatches(payload, domains);
      fallbackResponses.push(exactMatches);

      const resolvedCompanyIds = dedupe(
        exactMatches
          .map((row) => resolveCompanyId(row))
          .filter((value): value is string => Boolean(value)),
      )
        .filter((value) => !crustdataCompanyIds.some((candidate) => String(candidate) === value))
        .map((value) => Number(value));
      const resolvedProfileUrls = dedupe(
        exactMatches
          .map((row) => firstString(row.linkedin_profile_url, asRecord(row.basic_info)?.professional_network_url))
          .filter((value): value is string => Boolean(value)),
      ).filter((value) => !profileUrls.includes(value));
      const resolvedNames = dedupe(
        exactMatches
          .map((row) => firstString(row.company_name, asRecord(row.basic_info)?.name))
          .filter((value): value is string => Boolean(value)),
      ).filter((value) => !names.includes(value));

      if (resolvedCompanyIds.length > 0) {
        responses.push(
          await this.post("/company/enrich", {
            crustdata_company_ids: resolvedCompanyIds,
            fields: COMPANY_ENRICH_FIELDS,
          }),
        );
      }

      if (resolvedProfileUrls.length > 0) {
        responses.push(
          await this.post("/company/enrich", {
            professional_network_profile_urls: resolvedProfileUrls,
            fields: COMPANY_ENRICH_FIELDS,
          }),
        );
      } else if (resolvedCompanyIds.length === 0 && resolvedNames.length > 0) {
        responses.push(
          await this.post("/company/enrich", {
            names: resolvedNames,
            fields: COMPANY_ENRICH_FIELDS,
          }),
        );
      }
    }

    if (profileUrls.length > 0) {
      responses.push(
        await this.post("/company/enrich", {
          professional_network_profile_urls: profileUrls,
          fields: COMPANY_ENRICH_FIELDS,
        }),
      );
    }

    if (names.length > 0) {
      responses.push(
        await this.post("/company/enrich", {
          names,
          fields: COMPANY_ENRICH_FIELDS,
        }),
      );
    }

    const enriched = mergePayloads(responses);
    if (enriched.length > 0) {
      return enriched;
    }

    return mergePayloads(fallbackResponses);
  }

  async enrichPeople(spec: ValidatedWorkflowSpec) {
    const identifiers = dedupe(spec.inputs.identifiers);
    if (identifiers.length === 0) {
      return [];
    }

    const profileUrls = identifiers.filter((value) => value.includes("linkedin.com/"));
    const businessEmails = identifiers.filter((value) => value.includes("@"));
    const responses: unknown[] = [];

    if (profileUrls.length > 0) {
      responses.push(
        await this.post("/person/enrich", {
          professional_network_profile_urls: profileUrls,
          fields: spec.fieldSelections.person,
        }),
      );
    }

    if (businessEmails.length > 0) {
      responses.push(
        await this.post("/person/enrich", {
          business_emails: businessEmails,
          fields: spec.fieldSelections.person,
        }),
      );
    }

    return mergePayloads(responses);
  }

  async searchCompanies(spec: ValidatedWorkflowSpec) {
    const filters = spec.inputs.filters
      ? sanitizeSearchFilters(spec.inputs.filters, SUPPORTED_COMPANY_SEARCH_FILTER_FIELDS)
      : undefined;

    return this.post("/company/search", {
      filters: filters ? serializeFilters(filters) : undefined,
      limit: spec.inputs.limit,
      fields: COMPANY_SEARCH_FIELDS,
    });
  }

  async searchPeople(spec: ValidatedWorkflowSpec) {
    const filters = spec.inputs.filters
      ? sanitizeSearchFilters(spec.inputs.filters, SUPPORTED_PERSON_SEARCH_FILTER_FIELDS)
      : undefined;

    return this.post("/person/search", {
      filters: filters ? serializeFilters(filters) : undefined,
      limit: spec.inputs.limit,
      fields: [
        "person_id",
        "professional_network_profile_url",
        "business_email",
        "basic_profile.name",
        "basic_profile.headline",
        "experience.employment_details.current.company_name",
        "experience.employment_details.current.title",
      ],
    });
  }

  async autocompleteCompanies(query: string, scope?: FilterCondition | FilterGroup) {
    return this.post("/company/search/autocomplete", {
      field: "taxonomy.professional_network_industry",
      query,
      limit: 5,
      filters: scope ? serializeFilters(scope) : undefined,
    });
  }

  async autocompletePeople(query: string, scope?: FilterCondition | FilterGroup) {
    return this.post("/person/search/autocomplete", {
      field: "experience.employment_details.current.title",
      query,
      limit: 5,
      filters: scope ? serializeFilters(scope) : undefined,
    });
  }

  private async post(path: string, body: unknown, attempt = 0): Promise<unknown> {
    const response = await this.fetchWithAuthFallback(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status >= 500 && attempt < 2) {
        await wait(250 * (attempt + 1));
        return this.post(path, body, attempt + 1);
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      throw new Error(
        normalizeCrustError(response.status, payload) ??
          `CrustData request failed for ${path}`,
      );
    }

    return response.json();
  }

  private async get(path: string, params: Record<string, string>, attempt = 0): Promise<unknown> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await this.fetchWithAuthFallback(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status >= 500 && attempt < 2) {
        await wait(250 * (attempt + 1));
        return this.get(path, params, attempt + 1);
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      throw new Error(
        normalizeCrustError(response.status, payload) ??
          `CrustData request failed for ${path}`,
      );
    }

    return response.json();
  }

  private async fetchWithAuthFallback(input: string, init: RequestInit) {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...this.baseHeaders("Bearer"),
        ...(init.headers ?? {}),
      },
    });

    if (response.status !== 401 && response.status !== 403) {
      return response;
    }

    return fetch(input, {
      ...init,
      headers: {
        ...this.baseHeaders("Token"),
        ...(init.headers ?? {}),
      },
    });
  }

  private baseHeaders(scheme: "Bearer" | "Token") {
    return {
      authorization: `${scheme} ${this.apiKey}`,
      "x-api-version": this.apiVersion,
    };
  }
}

function normalizeCrustError(status: number, payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return `CrustData request failed with status ${status}.`;
  }

  const candidate = payload as {
    error?: { message?: string; description?: string };
    reason?: string;
    description?: string;
    message?: string;
  };
  const message =
    candidate.error?.message ??
    candidate.error?.description ??
    candidate.reason ??
    candidate.description ??
    candidate.message;

  return message ? `CrustData ${status}: ${message}` : null;
}

function isDomain(value: string) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function mergePayloads(payloads: unknown[]) {
  const rows = payloads.flatMap(extractPayloadRows);
  const deduped = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = resolvePayloadRowKey(row);
    if (!key || !deduped.has(key)) {
      deduped.set(key ?? `row-${deduped.size}`, row);
    }
  }

  return [...deduped.values()];
}

function filterExactCompanyMatches(payload: unknown, requestedDomains: string[]) {
  const requested = new Set(requestedDomains.map((domain) => domain.toLowerCase()));
  const matches = extractPayloadRows(payload)
    .map((row) => ({
      row,
      requestedDomain: resolveRequestedDomain(row, requested),
    }))
    .filter(
      (
        entry,
      ): entry is { row: Record<string, unknown>; requestedDomain: string } =>
        Boolean(entry.requestedDomain),
    );

  const bestMatchByDomain = new Map<string, Record<string, unknown>>();

  for (const match of matches) {
    const previous = bestMatchByDomain.get(match.requestedDomain);
    if (!previous) {
      bestMatchByDomain.set(match.requestedDomain, match.row);
      continue;
    }

    if (
      scoreCompanyMatch(match.row, match.requestedDomain) >
      scoreCompanyMatch(previous, match.requestedDomain)
    ) {
      bestMatchByDomain.set(match.requestedDomain, match.row);
    }
  }

  return [...bestMatchByDomain.values()];
}

function extractPayloadRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => normalizePayloadEntry(asRecord(entry)));
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.results)) {
    return record.results.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(record.data)) {
    return record.data.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(record.companies)) {
    return record.companies.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(record.people)) {
    return record.people.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(record.profiles)) {
    return record.profiles.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(record.value)) {
    return record.value.flatMap((entry) => flattenEnrichEntry(asRecord(entry)));
  }

  return [];
}

function normalizePayloadEntry(entry: Record<string, unknown> | null) {
  if (!entry) {
    return [];
  }

  const flattened = flattenEnrichEntry(entry);
  return flattened.length > 0 ? flattened : [entry];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumericId(value: string) {
  return /^\d+$/.test(value.trim());
}

function isCompanyProfileUrl(value: string) {
  return value.includes("linkedin.com/company");
}

function resolveCompanyId(row: Record<string, unknown>) {
  const value = firstString(
    row.crustdata_company_id,
    asRecord(row.company_data)?.crustdata_company_id,
    asRecord(row.basic_info)?.crustdata_company_id,
  );

  return value && /^\d+$/.test(value) ? value : null;
}

function resolveRequestedDomain(
  row: Record<string, unknown>,
  requested: Set<string>,
) {
  const entryDomain = firstString(
    row.company_website_domain,
    row.domain,
    asRecord(row.basic_info)?.domain,
  )?.toLowerCase();
  if (entryDomain && requested.has(entryDomain)) {
    return entryDomain;
  }

  const domains = Array.isArray(row.domains)
    ? row.domains.filter(isString).map((value) => value.toLowerCase())
    : [];

  return domains.find((domain) => requested.has(domain)) ?? null;
}

function scoreCompanyMatch(row: Record<string, unknown>, requestedDomain: string) {
  const website = firstString(row.company_website);
  const rootWebsiteBonus = isRootWebsiteForDomain(website, requestedDomain) ? 100_000 : 0;
  const headcountValue = firstString(
    asRecord(row.headcount)?.linkedin_headcount,
    row.employee_count_range,
  );
  const headcountMatch = headcountValue?.match(/\d+/);
  const headcount = headcountMatch ? Number(headcountMatch[0]) : 0;

  return rootWebsiteBonus + headcount;
}

function isRootWebsiteForDomain(value: string | null, requestedDomain: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.hostname.toLowerCase() === requestedDomain &&
      (url.pathname === "/" || url.pathname === "")
    );
  } catch {
    return false;
  }
}

function resolvePayloadRowKey(row: Record<string, unknown>) {
  return firstString(
    resolveCompanyId(row),
    row.person_id,
    row.matched_on,
    row.company_website_domain,
    row.professional_network_profile_url,
    row.linkedin_profile_url,
    firstString(asRecord(row.basic_info)?.primary_domain, asRecord(row.basic_info)?.domain),
    firstString(asRecord(row.company_data)?.company_website_domain),
    firstString(asRecord(row.basic_profile)?.linkedin_profile_url),
    row.business_email,
    row.work_email,
  );
}

function serializeFilters(filter: FilterCondition | FilterGroup): unknown {
  if ("operator" in filter) {
    return {
      op: filter.operator,
      conditions: filter.conditions.map(serializeFilters),
    };
  }

  return {
    field: filter.field,
    type: normalizeFilterType(filter.type),
    value: filter.value,
  };
}

function normalizeFilterType(type: FilterCondition["type"]) {
  if (type === "contains") {
    return "=";
  }

  if (type === ">=" || type === "=>") {
    return "=>";
  }

  if (type === "<=" || type === "=<") {
    return "=<";
  }

  return type;
}

function sanitizeSearchFilters(
  filter: FilterCondition | FilterGroup,
  supportedFields: ReadonlySet<string>,
): FilterCondition | FilterGroup | undefined {
  if ("field" in filter) {
    return supportedFields.has(filter.field) ? filter : undefined;
  }

  const conditions = filter.conditions
    .map((condition) => sanitizeSearchFilters(condition, supportedFields))
    .filter(Boolean) as Array<FilterCondition | FilterGroup>;

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return {
    ...filter,
    conditions,
  };
}

function flattenEnrichEntry(entry: Record<string, unknown> | null) {
  if (!entry) {
    return [];
  }

  if (entry.company_data || entry.person_data) {
    return [entry];
  }

  if (!Array.isArray(entry.matches)) {
    return [];
  }

  const bestMatch = entry.matches
    .map(asRecord)
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(asRecord(right)?.confidence_score ?? 0) -
        Number(asRecord(left)?.confidence_score ?? 0),
    )[0];

  if (!bestMatch) {
    return [];
  }

  return [
    {
      ...bestMatch,
      matched_on: entry.matched_on ?? bestMatch.matched_on,
      match_type: entry.match_type ?? bestMatch.match_type,
    },
  ];
}
