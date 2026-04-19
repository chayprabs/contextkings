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
    const identifiers = spec.inputs.identifiers;
    if (identifiers.length === 0) {
      return [];
    }

    const domains = identifiers.filter(isDomain);
    const profileUrls = identifiers.filter((value) => value.includes("linkedin.com/company"));
    const names = identifiers.filter(
      (value) => !isDomain(value) && !value.includes("linkedin.com/company"),
    );

    const body =
      profileUrls.length > 0
          ? {
              professional_network_profile_urls: profileUrls,
              fields: spec.fieldSelections.company,
            }
          : { names, fields: spec.fieldSelections.company };

    if (domains.length > 0) {
      return this.get("/screener/company", {
        company_domain: domains.join(","),
        fields: COMPANY_SCREENER_FIELDS.join(","),
      });
    }

    return this.post("/company/enrich", body);
  }

  async enrichPeople(spec: ValidatedWorkflowSpec) {
    const identifiers = spec.inputs.identifiers;
    if (identifiers.length === 0) {
      return [];
    }

    const profileUrls = identifiers.filter((value) => value.includes("linkedin.com/"));
    const businessEmails = identifiers.filter((value) => value.includes("@"));

    const body =
      profileUrls.length > 0
        ? {
            professional_network_profile_urls: profileUrls,
            fields: spec.fieldSelections.person,
          }
        : {
            business_emails: businessEmails,
            fields: spec.fieldSelections.person,
          };

    return this.post("/person/enrich", body);
  }

  async searchCompanies(spec: ValidatedWorkflowSpec) {
    return this.post("/company/search", {
      filters: spec.inputs.filters,
      limit: spec.inputs.limit,
      fields: [
        "crustdata_company_id",
        "basic_info.name",
        "basic_info.domain",
        "taxonomy.professional_network_industry",
        "headcount.total",
        "funding.total_investment_usd",
      ],
    });
  }

  async searchPeople(spec: ValidatedWorkflowSpec) {
    return this.post("/person/search", {
      filters: spec.inputs.filters,
      limit: spec.inputs.limit,
      fields: [
        "person_id",
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
      filters: scope,
    });
  }

  async autocompletePeople(query: string, scope?: FilterCondition | FilterGroup) {
    return this.post("/person/search/autocomplete", {
      field: "experience.employment_details.current.title",
      query,
      limit: 5,
      filters: scope,
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
