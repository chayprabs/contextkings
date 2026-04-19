import { createThreadStateSnapshot, type RunResult, type SourceContext, type ValidatedWorkflowSpec, type WorkflowSpec } from "@/lib/workflow/schema";
import { heuristicWorkflowFromPrompt } from "@/lib/workflow/planner";
import { validateWorkflowSpec } from "@/lib/workflow/validator";

export type WorkflowStepType =
  | "source"
  | "filter"
  | "enrich"
  | "analyze"
  | "output";

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  label: string;
  description: string;
  confirmed: boolean;
}

export interface PlanMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type ViewType =
  | "company-research"
  | "candidate-list"
  | "comparison";

export interface ExecutionMetadata {
  records: number;
  entity: string;
  duration: string;
}

export interface ExecutionResponse {
  run: RunResult;
  viewType: ViewType;
  metadata: ExecutionMetadata;
}

const REQUIRED_EXECUTION_STEP_TYPES: WorkflowStepType[] = [
  "source",
  "enrich",
  "analyze",
  "output",
];

export function workflowToPlanSteps(
  workflow: WorkflowSpec | ValidatedWorkflowSpec,
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  steps.push({
    id: "source-1",
    type: "source",
    label: buildSourceLabel(workflow),
    description: buildSourceDescription(workflow),
    confirmed: true,
  });

  if (shouldIncludeFilterStep(workflow)) {
    steps.push({
      id: `filter-${steps.length + 1}`,
      type: "filter",
      label: buildFilterLabel(workflow),
      description: buildFilterDescription(workflow),
      confirmed: true,
    });
  }

  if (shouldIncludeEnrichStep(workflow)) {
    steps.push({
      id: `enrich-${steps.length + 1}`,
      type: "enrich",
      label: buildEnrichLabel(workflow),
      description: buildEnrichDescription(workflow),
      confirmed: true,
    });
  }

  steps.push({
    id: `analyze-${steps.length + 1}`,
    type: "analyze",
    label: buildAnalyzeLabel(workflow),
    description: buildAnalyzeDescription(workflow),
    confirmed: true,
  });

  steps.push({
    id: `output-${steps.length + 1}`,
    type: "output",
    label: buildOutputLabel(workflow),
    description: buildOutputDescription(workflow),
    confirmed: true,
  });

  return steps;
}

export function buildPlanAssistantMessage(
  workflow: ValidatedWorkflowSpec,
  steps: WorkflowStep[],
) {
  const warnings =
    workflow.warnings.length > 0
      ? ` ${workflow.warnings[0]}`
      : "";
  const assumptions =
    workflow.assumptions.length > 0
      ? ` I also noted ${workflow.assumptions[0].charAt(0).toLowerCase()}${workflow.assumptions[0].slice(1)}`
      : "";

  return `I mapped this request into a ${steps.length}-step ${describeWorkflowShape(workflow)} workflow. We will start with ${steps[0]?.label.toLowerCase() ?? "the source step"}, then move through ${steps
    .slice(1, -1)
    .map((step) => step.label.toLowerCase())
    .join(", ")}, and finish with ${steps.at(-1)?.label.toLowerCase() ?? "the final output"}.${
    assumptions ? `${assumptions}.` : ""
  }${warnings}`;
}

export function detectViewType(
  steps: WorkflowStep[],
  workflow?: WorkflowSpec | ValidatedWorkflowSpec | null,
) {
  if (workflow?.entityType === "person") {
    return "candidate-list" satisfies ViewType;
  }

  if (workflow?.uiIntent === "comparison-view") {
    return "comparison" satisfies ViewType;
  }

  const allText = steps
    .map((step) => `${step.label} ${step.description}`)
    .join(" ")
    .toLowerCase();
  const goalText = workflow?.goal.toLowerCase() ?? "";

  if (
    allText.includes("candidate") ||
    allText.includes("profile") ||
    allText.includes("linkedin") ||
    goalText.includes("candidate") ||
    goalText.includes("linkedin")
  ) {
    return "candidate-list" satisfies ViewType;
  }

  if (
    allText.includes("comparison") ||
    allText.includes("compare") ||
    allText.includes("side-by-side") ||
    goalText.includes("compare") ||
    goalText.includes("comparison") ||
    goalText.includes("side-by-side") ||
    goalText.includes("versus")
  ) {
    return "comparison" satisfies ViewType;
  }

  return "company-research" satisfies ViewType;
}

export function createExecutionMetadata(
  run: RunResult,
  viewType: ViewType,
  durationMs: number,
): ExecutionMetadata {
  const entity =
    viewType === "candidate-list" ? "Candidates" : "Companies";

  return {
    records: run.counts.enriched,
    entity,
    duration: formatDuration(durationMs),
  };
}

export function hasExecutablePlanSteps(steps: WorkflowStep[]) {
  return REQUIRED_EXECUTION_STEP_TYPES.every((type) =>
    steps.some((step) => step.type === type),
  );
}

export function createExecutionBlockerMessage(steps: WorkflowStep[]) {
  const missing = REQUIRED_EXECUTION_STEP_TYPES.filter(
    (type) => !steps.some((step) => step.type === type),
  );

  if (missing.length === 0) {
    return null;
  }

  return `This plan is missing ${missing.join(", ")} step${missing.length > 1 ? "s" : ""}. Add them back by refining the workflow before you execute it.`;
}

export function applyPlanStepsToWorkflow(
  workflow: ValidatedWorkflowSpec,
  steps: WorkflowStep[],
) {
  const nextWorkflow = structuredClone(workflow);
  const hasFilter = steps.some((step) => step.type === "filter");

  if (!hasFilter) {
    delete nextWorkflow.inputs.filters;
  }

  const outputStep = steps.find((step) => step.type === "output");
  if (outputStep) {
    nextWorkflow.uiIntent = inferUiIntentFromStep(outputStep);
  }

  const analyzeStep = steps.find((step) => step.type === "analyze");
  if (analyzeStep) {
    nextWorkflow.llmTask = inferLlmTaskFromStep(analyzeStep, workflow);
  }

  nextWorkflow.warnings = [
    ...nextWorkflow.warnings,
    ...(hasFilter
      ? []
      : ["The filter step was removed in plan mode, so execution will run without extra narrowing criteria."]),
  ];

  return nextWorkflow;
}

export function buildFallbackPlan(
  prompt: string,
  sourceContext?: SourceContext | null,
) {
  const workflow = validateWorkflowSpec(
    heuristicWorkflowFromPrompt(
      prompt,
      createThreadStateSnapshot({
        sourceContext: sourceContext ?? null,
      }),
      sourceContext ?? null,
    ),
  );
  const steps = workflowToPlanSteps(workflow);

  return {
    workflow,
    steps,
    assistantMessage: buildPlanAssistantMessage(workflow, steps),
    viewType: detectViewType(steps, workflow),
  };
}

function shouldIncludeFilterStep(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return (
    workflow.inputMode === "company-search" ||
    workflow.inputMode === "person-search" ||
    Boolean(workflow.inputs.filters)
  );
}

function shouldIncludeEnrichStep(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.crustPlan.some((step) => step.step.includes("enrich"));
}

function buildSourceLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  switch (workflow.inputMode) {
    case "csv":
      return "CSV bootstrap source";
    case "company-search":
      return "CrustData company search";
    case "person-search":
      return "CrustData people search";
    case "web-search":
      return "Web search + fetch";
    default:
      return workflow.entityType === "person"
        ? "Known profiles + emails"
        : "Known companies + domains";
  }
}

function buildSourceDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  if (workflow.sourceHints.length > 0) {
    return `Start from ${workflow.sourceHints.join(", ")} and normalize it into a supported input adapter.`;
  }

  return "Normalize the request into a supported CrustData-compatible input source.";
}

function buildFilterLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  if (workflow.entityType === "person") {
    return "Candidate filters";
  }

  if (workflow.uiIntent === "comparison-view") {
    return "Comparison shortlist";
  }

  return "Stage and fit filter";
}

function buildFilterDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  if (workflow.inputs.filters) {
    return "Apply the requested criteria before enrichment so the shortlist stays focused.";
  }

  return "Narrow the source records to the most relevant entities before enrichment.";
}

function buildEnrichLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.entityType === "person"
    ? "Enrich candidate profiles"
    : "Enrich company records";
}

function buildEnrichDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.entityType === "person"
    ? "Add profile, experience, and contact context to each shortlisted person."
    : "Add taxonomy, headcount, funding, and business context to each shortlisted company.";
}

function buildAnalyzeLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  switch (workflow.llmTask) {
    case "score":
      return workflow.entityType === "person"
        ? "Score candidates"
        : "Score prospects";
    case "rank":
      return workflow.entityType === "person"
        ? "Rank candidates"
        : "Rank companies";
    case "classify":
      return "Classify records";
    case "cluster":
      return "Cluster the shortlist";
    case "draft-outreach":
      return "Draft outreach";
    case "extract-signals":
      return "Extract signals";
    case "research":
      return "Research the shortlist";
    default:
      return "Summarize the results";
  }
}

function buildAnalyzeDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return `Run the ${workflow.llmTask.replaceAll("-", " ")} step so the output is decision-ready.`;
}

function buildOutputLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  switch (workflow.uiIntent) {
    case "comparison-view":
      return "Side-by-side comparison";
    case "cards-first":
      return "Card workspace";
    case "report":
      return "Report view";
    case "table-first":
      return "Dashboard + table";
    case "list":
      return workflow.entityType === "person"
        ? "Candidate shortlist"
        : "Ranked list";
    default:
      return "Dashboard output";
  }
}

function buildOutputDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return `Render the final ${workflow.uiIntent.replaceAll("-", " ")} with the derived records and summary insights.`;
}

function describeWorkflowShape(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  if (workflow.entityType === "person") {
    return "candidate sourcing";
  }

  if (workflow.uiIntent === "comparison-view") {
    return "comparison";
  }

  return "company research";
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.round(seconds)}s`;
}

function inferUiIntentFromStep(step: WorkflowStep): WorkflowSpec["uiIntent"] {
  const text = `${step.label} ${step.description}`.toLowerCase();

  if (text.includes("comparison")) {
    return "comparison-view";
  }

  if (text.includes("report")) {
    return "report";
  }

  if (text.includes("card")) {
    return "cards-first";
  }

  if (text.includes("list")) {
    return "list";
  }

  if (text.includes("table")) {
    return "table-first";
  }

  return "dashboard";
}

function inferLlmTaskFromStep(
  step: WorkflowStep,
  workflow: ValidatedWorkflowSpec,
): WorkflowSpec["llmTask"] {
  const text = `${step.label} ${step.description}`.toLowerCase();

  if (text.includes("score")) {
    return "score";
  }

  if (text.includes("rank")) {
    return "rank";
  }

  if (text.includes("classif")) {
    return "classify";
  }

  if (text.includes("cluster")) {
    return "cluster";
  }

  if (text.includes("signal")) {
    return "extract-signals";
  }

  if (text.includes("research")) {
    return "research";
  }

  if (text.includes("outreach")) {
    return "draft-outreach";
  }

  return workflow.llmTask;
}
