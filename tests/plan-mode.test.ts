import { describe, expect, it } from "vitest";
import { applyPlanStepsToWorkflow, createExecutionBlockerMessage, detectViewType, workflowToPlanSteps } from "@/lib/plan-mode";
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
});
