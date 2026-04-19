import { describe, expect, it } from "vitest";
import { heuristicWorkflowFromPrompt } from "../lib/workflow/planner";
import { createThreadStateSnapshot } from "../lib/workflow/schema";
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
});
