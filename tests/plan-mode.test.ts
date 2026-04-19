import { describe, expect, it } from "vitest";
import {
  applyPlanStepsToWorkflow,
  createExecutionBlockerMessage,
  detectViewType,
  syncWorkflowPlanSteps,
  workflowToPlanSteps,
} from "@/lib/plan-mode";
import { heuristicWorkflowFromPrompt } from "@/lib/workflow/planner";
import { createThreadStateSnapshot } from "@/lib/workflow/schema";
import { validateWorkflowSpec } from "@/lib/workflow/validator";

describe("plan mode helpers", () => {
  it("builds a candidate-oriented workflow timeline for recruiting prompts", () => {
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Scout ML candidates from LinkedIn and rank them for a recruiting dashboard",
        createThreadStateSnapshot(),
        null,
      ),
    );

    const steps = workflowToPlanSteps(workflow);

    expect(steps[0]?.type).toBe("source");
    expect(steps.some((step) => step.type === "enrich")).toBe(true);
    expect(steps.some((step) => step.label.toLowerCase().includes("candidate"))).toBe(
      true,
    );
    expect(detectViewType(steps, workflow)).toBe("candidate-list");
  });

  it("detects comparison workflows from validated specs", () => {
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Compare three fintech companies side-by-side in a report",
        createThreadStateSnapshot(),
        null,
      ),
    );
    const steps = workflowToPlanSteps(workflow);

    expect(detectViewType(steps, workflow)).toBe("comparison");
  });

  it("blocks execution when required plan steps are removed", () => {
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Research software companies and score them for outbound",
        createThreadStateSnapshot(),
        null,
      ),
    );
    const steps = workflowToPlanSteps(workflow).filter((step) => step.type !== "enrich");

    expect(createExecutionBlockerMessage(steps)).toContain("enrich");
  });

  it("removes filters from execution when the filter step is deleted", () => {
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Search for fintech companies and build a dashboard",
        createThreadStateSnapshot(),
        null,
      ),
    );
    const steps = workflowToPlanSteps(workflow).filter((step) => step.type !== "filter");
    const executionWorkflow = applyPlanStepsToWorkflow(workflow, steps);

    expect(executionWorkflow.inputs.filters).toBeUndefined();
    expect(executionWorkflow.warnings.join(" ")).toContain("filter step was removed");
  });

  it("does not invent a removed-filter warning for plans that never had filters", () => {
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Enrich openai.com and stripe.com into a comparison dashboard",
        createThreadStateSnapshot(),
        null,
      ),
    );
    const executionWorkflow = applyPlanStepsToWorkflow(
      workflow,
      workflowToPlanSteps(workflow),
    );

    expect(executionWorkflow.warnings.join(" ")).not.toContain("filter step was removed");
  });

  it("breaks detailed company filters into stage and fit steps", () => {
    const latestWorkflow = heuristicWorkflowFromPrompt(
      "Research B2B SaaS companies in India for outbound",
      createThreadStateSnapshot(),
      null,
    );
    const workflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "add a more detailed filter request",
        createThreadStateSnapshot({
          latestWorkflow,
        }),
        null,
      ),
    );

    const steps = workflowToPlanSteps(workflow);
    const filterSteps = steps.filter((step) => step.type === "filter");

    expect(filterSteps.length).toBeGreaterThan(1);
    expect(filterSteps.map((step) => step.label)).toEqual(
      expect.arrayContaining(["Stage qualification", "ICP fit filter"]),
    );
  });

  it("removes the analyze step when the follow-up asks to delete the research step", () => {
    const latestWorkflow = validateWorkflowSpec(
      heuristicWorkflowFromPrompt(
        "Research B2B SaaS companies in India for outbound",
        createThreadStateSnapshot(),
        null,
      ),
    );

    const steps = syncWorkflowPlanSteps(
      latestWorkflow,
      "remove the research the shortlist step",
      workflowToPlanSteps(latestWorkflow),
    );

    expect(steps.some((step) => step.type === "analyze")).toBe(false);
  });
});
