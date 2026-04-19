import { describe, expect, it } from "vitest";
import { heuristicWorkflowFromPrompt } from "../lib/workflow/planner";
import { createThreadStateSnapshot, type SourceContext } from "../lib/workflow/schema";
import { validateWorkflowSpec } from "../lib/workflow/validator";

describe("workflow planning", () => {
  it("maps unsupported linkedin live language into supported assumptions", () => {
    const workflow = heuristicWorkflowFromPrompt(
      "Pull live LinkedIn profiles for candidate scouting and rank them for GTM",
      createThreadStateSnapshot(),
      null,
    );

    expect(workflow.entityType).toBe("person");
    expect(workflow.assumptions.join(" ")).toContain("LinkedIn");
    expect(workflow.warnings.join(" ")).toContain("unsupported");
  });

  it("constrains gated web workflows when web access is disabled", () => {
    const validated = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Use web news to monitor AI companies and build a dashboard",
        createThreadStateSnapshot(),
        null,
      ),
    );

    expect(validated.inputMode).not.toBe("web-search");
    expect(validated.warnings.join(" ")).toContain("disabled");
  });

  it("maps exploratory recruiting prompts into person search with title filters", () => {
    const validated = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Scout senior machine learning candidates in India and rank them for recruiting",
        createThreadStateSnapshot(),
        null,
      ),
    );

    expect(validated.inputMode).toBe("person-search");
    expect(validated.inputs.filters).toMatchObject({
      field: "experience.employment_details.current.title",
      type: "contains",
      value: "Machine Learning Engineer",
    });
  });

  it("adds company search filters for exploratory market prompts", () => {
    const validated = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Research B2B SaaS companies in India for outbound",
        createThreadStateSnapshot(),
        null,
      ),
    );

    expect(validated.inputMode).toBe("company-search");
    expect(validated.inputs.filters).toMatchObject({
      operator: "and",
      conditions: expect.arrayContaining([
        expect.objectContaining({
          field: "taxonomy.professional_network_industry",
          value: "Software",
        }),
        expect.objectContaining({
          field: "hq_country",
          value: "India",
        }),
      ]),
    });
  });

  it("extracts identifiers from every source row without regex state bleed", () => {
    const sourceContext: SourceContext = {
      kind: "csv",
      label: "domains.csv",
      content: "domain\nopenai.com\nstripe.com",
      records: [
        { domain: "openai.com" },
        { domain: "stripe.com" },
      ],
    };

    const workflow = heuristicWorkflowFromPrompt(
      "Compare these companies",
      createThreadStateSnapshot({
        sourceContext,
      }),
      sourceContext,
    );

    expect(workflow.inputs.identifiers).toEqual(
      expect.arrayContaining(["openai.com", "stripe.com"]),
    );
  });

  it("treats short filter follow-ups as refinements of the previous workflow", () => {
    const latestWorkflow = heuristicWorkflowFromPrompt(
      "Research B2B SaaS companies in India for outbound",
      createThreadStateSnapshot(),
      null,
    );

    const workflow = heuristicWorkflowFromPrompt(
      "add a more detailed filter request",
      createThreadStateSnapshot({
        latestWorkflow,
      }),
      null,
    );

    expect(workflow.goal).toContain("Research B2B SaaS companies in India for outbound");
    expect(workflow.inputMode).toBe("company-search");
    expect(workflow.inputs.filters).toBeDefined();
    expect(workflow.assumptions.join(" ")).toContain("follow-up refinement");
  });
});
