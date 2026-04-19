import { validatedWorkflowSchema, workflowSpecSchema, type ValidatedWorkflowSpec, type WorkflowSpec } from "@/lib/workflow/schema";

export function validateWorkflowSpec(spec: WorkflowSpec): ValidatedWorkflowSpec {
  const parsed = workflowSpecSchema.parse(spec);
  const warnings = [...parsed.warnings];
  const assumptions = [...parsed.assumptions];
  const webEnabled = process.env.CRUSTDATA_ENABLE_WEB === "true";
  const executionMode = process.env.CRUSTDATA_API_KEY ? "live" : "mock";
  let inputMode = parsed.inputMode;
  let crustPlan = [...parsed.crustPlan];

  if (inputMode === "web-search" && !webEnabled) {
    inputMode = parsed.entityType === "person" ? "person-search" : "company-search";
    warnings.push("Web access is disabled, so the workflow has been constrained to the closest supported search flow.");
    assumptions.push("Web intent was remapped because CRUSTDATA_ENABLE_WEB is not enabled.");
    crustPlan = crustPlan.filter((step) => step.step !== "web-search");
  }

  if (parsed.inputs.identifiers.length > 0) {
    if (parsed.entityType === "person") {
      inputMode = inputMode === "csv" ? "csv" : "manual-list";
      crustPlan = [
        {
          step: "person-enrich",
          endpoint: "/person/enrich",
          reason: "Known people identifiers allow direct enrichment.",
        },
        ...crustPlan.filter((step) => step.step === "llm-derive"),
      ];
    }

    if (parsed.entityType === "company") {
      inputMode = inputMode === "csv" ? "csv" : "manual-list";
      crustPlan = [
        {
          step: "company-enrich",
          endpoint: "/company/enrich",
          reason: "Known company identifiers allow direct enrichment.",
        },
        ...crustPlan.filter((step) => step.step === "llm-derive"),
      ];
    }
  }

  const resolvedEndpoints = crustPlan
    .map((step) => step.endpoint)
    .filter((endpoint): endpoint is string => Boolean(endpoint));

  const fieldSelections = {
    company: [
      "basic_info",
      "headcount",
      "funding",
      "locations",
      "taxonomy",
    ],
    person: [
      "basic_profile",
      "experience",
      "education",
      "skills",
      "contact",
      "social_handles",
    ],
  };

  if (executionMode === "mock") {
    warnings.push("CRUSTDATA_API_KEY is not configured, so execution will run in mock mode.");
  }

  return validatedWorkflowSchema.parse({
    ...parsed,
    inputMode,
    crustPlan,
    warnings: dedupe(warnings),
    assumptions: dedupe(assumptions),
    resolvedEndpoints,
    fieldSelections,
    executionMode,
    webEnabled,
  });
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}
