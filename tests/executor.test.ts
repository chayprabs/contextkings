import { afterEach, describe, expect, it, vi } from "vitest";
import { isNonEmptySpec, validateSpec } from "@json-render/core";
import { runWorkflow } from "@/lib/workflow/executor";
import { createThreadStateSnapshot, type ValidatedWorkflowSpec } from "@/lib/workflow/schema";

const baseSpec: ValidatedWorkflowSpec = {
  goal: "Find Indian fintech companies",
  inputMode: "company-search",
  entityType: "company",
  sourceHints: [],
  crustPlan: [
    { step: "company-search", endpoint: "/company/search" },
    { step: "company-enrich", endpoint: "/company/enrich" },
  ],
  llmTask: "score",
  uiIntent: "list",
  assumptions: [],
  warnings: [],
  inputs: {
    limit: 3,
    identifiers: [],
    manualEntries: [],
    sourceColumns: [],
    filters: {
      operator: "and",
      conditions: [
        {
          field: "taxonomy.professional_network_industry",
          type: "contains",
          value: "Financial Services",
        },
        {
          field: "hq_country",
          type: "=",
          value: "India",
        },
      ],
    },
  },
  resolvedEndpoints: ["/company/search", "/company/enrich"],
  fieldSelections: {
    company: ["basic_info", "headcount", "funding", "hiring", "locations", "taxonomy"],
    person: ["basic_profile", "experience"],
  },
  executionMode: "live",
  webEnabled: true,
};

afterEach(() => {
  delete process.env.CRUSTDATA_API_KEY;
  vi.restoreAllMocks();
});

describe("runWorkflow", () => {
  it("completes a company search by enriching crustdata ids and applying local geography filters", async () => {
    process.env.CRUSTDATA_API_KEY = "test-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            companies: [
              { crustdata_company_id: 101, basic_info: { name: "A", primary_domain: "a.com" } },
              { crustdata_company_id: 202, basic_info: { name: "B", primary_domain: "b.com" } },
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
          JSON.stringify({
            value: [
              {
                matched_on: "101",
                matches: [
                  {
                    confidence_score: 1,
                    company_data: {
                      basic_info: { name: "A", primary_domain: "a.com" },
                      taxonomy: { professional_network_industry: "Financial Services" },
                      headcount: { total: 120 },
                      funding: { total_investment_usd: 5000000, last_round_type: "Series A" },
                      hiring: { openings_count: 4 },
                      locations: { headquarters: "Mumbai, Maharashtra, India" },
                    },
                  },
                ],
              },
              {
                matched_on: "202",
                matches: [
                  {
                    confidence_score: 1,
                    company_data: {
                      basic_info: { name: "B", primary_domain: "b.com" },
                      taxonomy: { professional_network_industry: "Financial Services" },
                      headcount: { total: 300 },
                      funding: { total_investment_usd: 9000000, last_round_type: "Series B" },
                      hiring: { openings_count: 10 },
                      locations: { headquarters: "New York, New York, USA" },
                    },
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const run = await runWorkflow(baseSpec, createThreadStateSnapshot());

    expect(run.status).toBe("completed");
    expect(run.counts.enriched).toBe(1);
    expect(run.records.map((record) => record.inputKey)).toEqual(["101"]);
    expect(run.records[0]?.derivedPayload).toMatchObject({
      name: "A",
      hqCountry: "India",
      fundingStage: "Series A",
      hiring: "4",
    });
    expect(isNonEmptySpec(run.uiModel)).toBe(true);
    expect(validateSpec(run.uiModel as Parameters<typeof validateSpec>[0]).valid).toBe(
      true,
    );
  });

  it("avoids generic company placeholders in mocked company-search runs", async () => {
    const run = await runWorkflow(
      {
        ...baseSpec,
        sourceHints: ["manual prompt"],
      },
      createThreadStateSnapshot(),
    );

    expect(run.status).toBe("mocked");
    expect(run.records.length).toBeGreaterThan(0);
    expect(
      run.records.every((record) => !/^company-\d+$/i.test(record.inputKey)),
    ).toBe(true);
    expect(
      run.records.every(
        (record) =>
          !/company \d+/i.test(String(record.derivedPayload?.name ?? "")),
      ),
    ).toBe(true);
    expect(
      run.records.every((record) => record.sourceHint === "manual prompt (mock)"),
    ).toBe(true);
    expect(isNonEmptySpec(run.uiModel)).toBe(true);
  });
});
