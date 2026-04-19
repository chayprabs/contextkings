import {
  createThreadStateSnapshot,
  type FilterCondition,
  type FilterGroup,
  type RunResult,
  type SourceContext,
  type ValidatedWorkflowSpec,
  type WorkflowSpec,
} from "@/lib/workflow/schema";
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
  attachment?: PlanAttachment | null;
}

export interface PlanAttachment {
  name: string;
  mimeType: string;
}

export interface SavedRun {
  id: string;
  runId?: string;
  title: string;
  timestamp: number;
  steps: WorkflowStep[];
  workflow?: ValidatedWorkflowSpec | null;
  sourceContext?: SourceContext | null;
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

  steps.push(...buildFilterSteps(workflow, steps.length));

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
  const filterSteps = steps.filter((step) => step.type === "filter");
  const warnings =
    workflow.warnings.length > 0
      ? ` ${workflow.warnings[0]}`
      : "";
  const assistantNote = selectAssistantNote(workflow);
  const intro = assistantNote?.toLowerCase().includes("follow-up refinement")
    ? "I refined the existing request into"
    : "I mapped this request into";
  const assumptionSuffix = assistantNote
    ? ` I also noted ${assistantNote.charAt(0).toLowerCase()}${assistantNote.slice(1)}.`
    : "";
  const filterSuffix =
    filterSteps.length > 1
      ? ` I split the filter phase into ${filterSteps.length} focused steps so stage and fit can be handled separately.`
      : "";

  return `${intro} a ${steps.length}-step ${describeWorkflowShape(workflow)} workflow. We will start with ${steps[0]?.label.toLowerCase() ?? "the source step"}, then move through ${steps
    .slice(1, -1)
    .map((step) => step.label.toLowerCase())
    .join(", ")}, and finish with ${steps.at(-1)?.label.toLowerCase() ?? "the final output"}.${
    assumptionSuffix
  }${filterSuffix}${warnings}`;
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

function buildFilterSteps(
  workflow: WorkflowSpec | ValidatedWorkflowSpec,
  currentStepCount: number,
) {
  if (!shouldIncludeFilterStep(workflow)) {
    return [];
  }

  const { stage, fit, guardrails } = classifyFilters(workflow.inputs.filters);
  const granularBreakdown =
    stage.length > 0 ||
    fit.length > 0 ||
    guardrails.length > 0 ||
    workflow.assumptions.some((assumption) =>
      assumption.toLowerCase().includes("stage and fit"),
    );

  if (!granularBreakdown) {
    return [
      {
        id: `filter-${currentStepCount + 1}`,
        type: "filter" as const,
        label: buildFilterLabel(workflow),
        description: buildFilterDescription(workflow),
        confirmed: true,
      },
    ];
  }

  const steps: WorkflowStep[] = [];

  steps.push({
    id: `filter-${currentStepCount + steps.length + 1}`,
    type: "filter",
    label: workflow.entityType === "person" ? "Qualification gate" : "Stage qualification",
    description:
      stage.length > 0
        ? `Gate the shortlist using ${summarizeConditions(stage)} before enrichment.`
        : "Gate the shortlist using maturity, size, or momentum signals before enrichment.",
    confirmed: true,
  });

  steps.push({
    id: `filter-${currentStepCount + steps.length + 1}`,
    type: "filter",
    label: workflow.entityType === "person" ? "Role-fit filter" : "ICP fit filter",
    description:
      fit.length > 0
        ? `Keep only records that match ${summarizeConditions(fit)}.`
        : "Keep only records that match the strongest industry, geography, or role-fit signals.",
    confirmed: true,
  });

  if (guardrails.length > 0) {
    steps.push({
      id: `filter-${currentStepCount + steps.length + 1}`,
      type: "filter",
      label: "Shortlist guardrails",
      description: `Apply the remaining guardrails for ${summarizeConditions(guardrails)}.`,
      confirmed: true,
    });
  }

  return steps;
}

function shouldIncludeEnrichStep(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.crustPlan.some((step) => step.step.includes("enrich"));
}

function selectAssistantNote(workflow: ValidatedWorkflowSpec) {
  return workflow.assumptions.find((assumption) => !isGeneratedMarker(assumption));
}

function isGeneratedMarker(value: string) {
  return value.startsWith("Workflow draft generated with ");
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

function classifyFilters(filters?: FilterCondition | FilterGroup) {
  const flattened = flattenFilters(filters);

  return flattened.reduce<{
    stage: FilterCondition[];
    fit: FilterCondition[];
    guardrails: FilterCondition[];
  }>(
    (accumulator, condition) => {
      const field = condition.field.toLowerCase();
      if (
        field.includes("funding") ||
        field.includes("headcount") ||
        field.includes("job_openings")
      ) {
        accumulator.stage.push(condition);
        return accumulator;
      }

      if (
        field.includes("industry") ||
        field.includes("country") ||
        field.includes("location") ||
        field.includes("title") ||
        field.includes("skill")
      ) {
        accumulator.fit.push(condition);
        return accumulator;
      }

      accumulator.guardrails.push(condition);
      return accumulator;
    },
    {
      stage: [],
      fit: [],
      guardrails: [],
    },
  );
}

function flattenFilters(filters?: FilterCondition | FilterGroup): FilterCondition[] {
  if (!filters) {
    return [];
  }

  if ("field" in filters) {
    return [filters];
  }

  return filters.conditions.flatMap((condition) => flattenFilters(condition));
}

function summarizeConditions(conditions: FilterCondition[]) {
  return conditions
    .map((condition) => describeCondition(condition))
    .join(", ");
}

function describeCondition(condition: FilterCondition) {
  const field = condition.field.split(".").at(-1)?.replaceAll("_", " ") ?? condition.field;
  const normalizedValue = Array.isArray(condition.value)
    ? condition.value.join("/")
    : String(condition.value);

  switch (condition.type) {
    case "=":
      return `${field} = ${normalizedValue}`;
    case "contains":
      return `${field} contains ${normalizedValue}`;
    case "in":
      return `${field} in ${normalizedValue}`;
    case ">=":
    case "=>":
      return `${field} >= ${normalizedValue}`;
    case "<=":
    case "=<":
      return `${field} <= ${normalizedValue}`;
    default:
      return `${field} ${condition.type} ${normalizedValue}`;
  }
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
