import { afterEach, describe, expect, it, vi } from "vitest";
import { CrustDataClient } from "@/lib/crustdata/client";
import type { ValidatedWorkflowSpec } from "@/lib/workflow/schema";

const baseSpec: ValidatedWorkflowSpec = {
  goal: "Test workflow",
  inputMode: "company-search",
  entityType: "company",
  sourceHints: [],
  crustPlan: [],
  llmTask: "summarize",
  uiIntent: "dashboard",
  assumptions: [],
  warnings: [],
  inputs: {
    limit: 8,
    identifiers: [],
    manualEntries: [],
    sourceColumns: [],
  },
  resolvedEndpoints: [],
  fieldSelections: {
    company: ["basic_info", "headcount", "funding", "hiring", "locations", "taxonomy"],
    person: ["basic_profile", "experience"],
  },
  executionMode: "live",
  webEnabled: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CrustDataClient", () => {
  it("sanitizes company search filters and normalizes operators", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ companies: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CrustDataClient("test-key");
    await client.searchCompanies({
      ...baseSpec,
      inputs: {
        ...baseSpec.inputs,
        filters: {
          operator: "and",
          conditions: [
            {
              field: "taxonomy.professional_network_industry",
              type: "contains",
              value: "Software",
            },
            {
              field: "headcount.total",
              type: ">=",
              value: 50,
            },
            {
              field: "hq_country",
              type: "=",
              value: "India",
            },
          ],
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as {
      filters: {
        op: string;
        conditions: Array<{ field: string; type: string; value: unknown }>;
      };
    };

    expect(payload.filters.conditions).toEqual([
      {
        field: "taxonomy.professional_network_industry",
        type: "=",
        value: "Software",
      },
      {
        field: "headcount.total",
        type: "=>",
        value: 50,
      },
    ]);
  });

  it("uses crustdata company ids and flattens enrich matches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              matched_on: "631466",
              matches: [
                {
                  confidence_score: 1,
                  company_data: {
                    basic_info: { name: "OpenAI", primary_domain: "openai.com" },
                  },
                },
              ],
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CrustDataClient("test-key");
    const response = await client.enrichCompanies({
      ...baseSpec,
      inputMode: "manual-list",
      inputs: {
        ...baseSpec.inputs,
        identifiers: ["631466", "openai.com"],
      },
    });

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const firstPayload = JSON.parse(String(firstInit.body)) as {
      crustdata_company_ids: number[];
      fields: string[];
    };

    expect(firstUrl).toContain("/company/enrich");
    expect(firstPayload.crustdata_company_ids).toEqual([631466]);
    expect(firstPayload.fields).toContain("funding");
    expect(firstPayload.fields).toContain("hiring");
    expect(response).toEqual([
      {
        confidence_score: 1,
        matched_on: "631466",
        company_data: {
          basic_info: { name: "OpenAI", primary_domain: "openai.com" },
        },
      },
    ]);
  });

  it("resolves domains through the company screener and then enriches the matched company ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            companies: [
              {
                crustdata_company_id: 631466,
                company_name: "OpenAI",
                company_website: "https://openai.com/",
                company_website_domain: "openai.com",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              matched_on: "631466",
              matches: [
                {
                  confidence_score: 1,
                  company_data: {
                    basic_info: { name: "OpenAI", primary_domain: "openai.com" },
                  },
                },
              ],
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CrustDataClient("test-key");
    const response = await client.enrichCompanies({
      ...baseSpec,
      inputMode: "manual-list",
      inputs: {
        ...baseSpec.inputs,
        identifiers: ["openai.com"],
      },
    });

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondPayload = JSON.parse(String(secondInit.body)) as {
      crustdata_company_ids: number[];
    };

    expect(secondUrl).toContain("/company/enrich");
    expect(secondPayload.crustdata_company_ids).toEqual([631466]);
    expect(response).toEqual([
      {
        confidence_score: 1,
        matched_on: "631466",
        company_data: {
          basic_info: { name: "OpenAI", primary_domain: "openai.com" },
        },
      },
    ]);
  });
});
