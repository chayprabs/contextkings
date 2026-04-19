import type { FilterCondition, FilterGroup, ValidatedWorkflowSpec } from "@/lib/workflow/schema";

const BASE_URL = "https://api.crustdata.com";
const COMPANY_SCREENER_FIELDS = [
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

    const domains = identifiers.filter(isDomain);
    const profileUrls = identifiers.filter((value) => value.includes("linkedin.com/company"));
    const names = identifiers.filter(
      (value) => !isDomain(value) && !value.includes("linkedin.com/company"),
    );
    const responses: unknown[] = [];

    if (domains.length > 0) {
      const payload = await this.get("/screener/company", {
        company_domain: domains.join(","),
        fields: COMPANY_SCREENER_FIELDS.join(","),
      });
      responses.push(filterExactCompanyMatches(payload, domains));
    }

    if (profileUrls.length > 0) {
      responses.push(
        await this.post("/company/enrich", {
          professional_network_profile_urls: profileUrls,
          fields: spec.fieldSelections.company,
        }),
      );
    }

    if (names.length > 0) {
      responses.push(
        await this.post("/company/enrich", {
          names,
          fields: spec.fieldSelections.company,
        }),
      );
    }

    return mergePayloads(responses);
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
    return this.post("/company/search", {
      filters: spec.inputs.filters ? serializeFilters(spec.inputs.filters) : undefined,
      limit: spec.inputs.limit,
      fields: [
        "crustdata_company_id",
        "company_name",
        "company_website_domain",
        "linkedin_profile_url",
        "taxonomy.linkedin_industries",
        "headcount.linkedin_headcount",
        "funding_and_investment.crunchbase_total_investment_usd",
      ],
    });
  }

  async searchPeople(spec: ValidatedWorkflowSpec) {
    return this.post("/person/search", {
      filters: spec.inputs.filters ? serializeFilters(spec.inputs.filters) : undefined,
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
  return payloads.flatMap(extractPayloadRows);
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
    return payload.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
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

  return [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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

function serializeFilters(filter: FilterCondition | FilterGroup): unknown {
  if ("operator" in filter) {
    return {
      op: filter.operator,
      conditions: filter.conditions.map(serializeFilters),
    };
  }

  return {
    field: filter.field,
    type: filter.type === "contains" ? "=" : filter.type,
    value: filter.value,
  };
}
