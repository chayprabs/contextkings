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

export function syncWorkflowPlanSteps(
  workflow: WorkflowSpec | ValidatedWorkflowSpec,
  prompt: string,
  latestSteps?: WorkflowStep[],
) {
  const baseSteps = workflowToPlanSteps(workflow);
  const syncedSteps = latestSteps?.length
    ? preserveRemovedStepTypes(baseSteps, latestSteps)
    : baseSteps;

  return applyPromptStepEdits(
    prompt,
    syncedSteps,
    latestSteps?.length ? latestSteps : syncedSteps,
  );
}

export function buildPlanAssistantMessage(
  workflow: ValidatedWorkflowSpec,
  steps: WorkflowStep[],
) {
  const assistantNote = selectAssistantNote(workflow);
  const normalizedAssistantNote = assistantNote?.replace(/[.!?\s]+$/, "");
  const warnings =
    workflow.warnings.length > 0
      ? ` ${workflow.warnings[0]}`
      : "";
  const intro = assistantNote?.toLowerCase().includes("follow-up refinement")
    ? "I refined the existing request into"
    : "I mapped this request into";
  const assumptionSuffix = normalizedAssistantNote
    ? ` I also noted ${normalizedAssistantNote.charAt(0).toLowerCase()}${normalizedAssistantNote.slice(1)}.`
    : "";
  const flow = steps.map((step) => step.label).join(" -> ");
  const filters = flattenFilters(workflow.inputs.filters);
  const filterSummary =
    filters.length > 0
      ? ` The run will honor ${summarizeConditions(filters)}.`
      : "";
  const outputSummary = ` The final ${workflow.uiIntent.replaceAll("-", " ")} will emphasize ${buildOutputFieldSummary(workflow)}.`;

  return `${intro} a ${steps.length}-step ${describeWorkflowShape(workflow)} workflow for ${workflow.goal.trim()}. Flow: ${flow}.${filterSummary}${outputSummary}${assumptionSuffix}${warnings}`;
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
  const originallyHadFilter = shouldIncludeFilterStep(workflow);

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
    ...(hasFilter || !originallyHadFilter
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
    label: buildFocusedFilterLabel(
      workflow.entityType === "person" ? "Qualification gate" : "Stage qualification",
      stage,
    ),
    description:
      stage.length > 0
        ? `Gate the shortlist using ${summarizeConditions(stage)} before enrichment.`
        : "Gate the shortlist using maturity, size, or momentum signals before enrichment.",
    confirmed: true,
  });

  steps.push({
    id: `filter-${currentStepCount + steps.length + 1}`,
    type: "filter",
    label: buildFocusedFilterLabel(
      workflow.entityType === "person" ? "Role-fit filter" : "ICP fit filter",
      fit,
    ),
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
      label: buildFocusedFilterLabel("Shortlist guardrails", guardrails),
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
      return workflow.entityType === "person"
        ? "Bootstrap from CSV candidate data"
        : "Bootstrap from CSV company data";
    case "company-search":
      return buildSearchFocus(workflow) ?? "Search target companies";
    case "person-search":
      return buildSearchFocus(workflow) ?? "Search target people";
    case "web-search":
      return "Web search + fetch";
    default:
      if (workflow.entityType === "person") {
        return containsProfileIdentifiers(workflow.inputs.identifiers)
          ? "Use provided profiles + emails"
          : "Use provided people identifiers";
      }

      return containsDomainIdentifiers(workflow.inputs.identifiers)
        ? "Use provided company domains"
        : "Use provided company identifiers";
  }
}

function buildSourceDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  const exampleInputs = summarizeInputExamples(workflow);

  if (workflow.sourceHints.length > 0) {
    return exampleInputs
      ? `Start from ${workflow.sourceHints.join(", ")} using ${exampleInputs} and normalize it into a supported input adapter.`
      : `Start from ${workflow.sourceHints.join(", ")} and normalize it into a supported input adapter.`;
  }

  if (workflow.inputMode === "company-search" || workflow.inputMode === "person-search") {
    const filters = flattenFilters(workflow.inputs.filters);
    return filters.length > 0
      ? `Query CrustData with ${summarizeConditions(filters)} before moving to enrichment.`
      : "Query CrustData using the prompt intent before moving to enrichment.";
  }

  return exampleInputs
    ? `Normalize ${exampleInputs} into a supported CrustData-compatible input source.`
    : "Normalize the request into a supported CrustData-compatible input source.";
}

function buildFilterLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  const filters = flattenFilters(workflow.inputs.filters);
  if (filters.length > 0) {
    const summaryLabel = summarizeFilterHeading(filters);
    if (summaryLabel) {
      return summaryLabel;
    }
  }

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
    return `Apply ${summarizeConditions(flattenFilters(workflow.inputs.filters))} before enrichment so the shortlist stays focused.`;
  }

  return "Narrow the source records to the most relevant entities before enrichment.";
}

function buildEnrichLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.entityType === "person"
    ? "Enrich role, company, and contact context"
    : "Enrich company firmographics";
}

function buildEnrichDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return workflow.entityType === "person"
    ? "Add name, current title, current company, location, experience, and contact fields to each shortlisted person."
    : "Add company name, domain, HQ, taxonomy, headcount, funding, hiring, and profile links to each shortlisted company.";
}

function buildAnalyzeLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  switch (workflow.llmTask) {
    case "score":
      return workflow.entityType === "person"
        ? "Score candidates for fit"
        : "Score companies for fit";
    case "rank":
      return workflow.entityType === "person"
        ? "Rank the candidate shortlist"
        : "Rank the company shortlist";
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
  return workflow.entityType === "person"
    ? `Use title, company, location, and experience data to ${workflow.llmTask.replaceAll("-", " ")} the shortlist.`
    : `Use company, HQ, industry, funding, hiring, and headcount data to ${workflow.llmTask.replaceAll("-", " ")} the shortlist.`;
}

function buildOutputLabel(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  switch (workflow.uiIntent) {
    case "comparison-view":
      return workflow.entityType === "person"
        ? "Side-by-side candidate comparison"
        : "Side-by-side company comparison";
    case "cards-first":
      return workflow.entityType === "person"
        ? "Candidate cards"
        : "Company cards";
    case "report":
      return workflow.entityType === "person"
        ? "Candidate report"
        : "Company report";
    case "table-first":
      return workflow.entityType === "person"
        ? "Candidate dashboard + table"
        : "Company dashboard + table";
    case "list":
      return workflow.entityType === "person"
        ? "Candidate shortlist"
        : "Ranked list";
    default:
      return "Dashboard output";
  }
}

function buildOutputDescription(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  return `Render the final ${workflow.uiIntent.replaceAll("-", " ")} with ${buildOutputFieldSummary(workflow)} and the summary insights.`;
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
        field.includes("job_openings") ||
        field.includes("hiring")
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

function buildSearchFocus(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  const filters = flattenFilters(workflow.inputs.filters);
  const industry = filters.find((condition) => condition.field.toLowerCase().includes("industry"));
  const geography = filters.find(
    (condition) =>
      condition.field.toLowerCase().includes("country") ||
      condition.field.toLowerCase().includes("location"),
  );
  const title = filters.find((condition) => condition.field.toLowerCase().includes("title"));
  const stage = filters.find((condition) => condition.field.toLowerCase().includes("funding"));
  const base =
    workflow.entityType === "person"
      ? title
        ? `Search ${describeConditionValue(title)} people`
        : "Search target people"
      : industry
        ? `Search ${describeConditionValue(industry)} companies`
        : "Search target companies";
  const suffix = [
    geography ? `in ${describeConditionValue(geography)}` : null,
    stage ? `at ${describeConditionValue(stage)}` : null,
  ].filter(Boolean);

  return suffix.length > 0 ? `${base} ${suffix.join(" ")}` : base;
}

function summarizeInputExamples(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  const candidates = [
    ...workflow.inputs.identifiers,
    ...workflow.inputs.manualEntries,
  ]
    .filter(Boolean)
    .slice(0, 3);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.join(", ");
}

function containsDomainIdentifiers(values: string[]) {
  return values.some((value) => /\b[a-z0-9.-]+\.[a-z]{2,}\b/i.test(value));
}

function containsProfileIdentifiers(values: string[]) {
  return values.some((value) => value.includes("linkedin.com/") || value.includes("@"));
}

function summarizeFilterHeading(conditions: FilterCondition[]) {
  const stage = conditions.filter((condition) => isStageFilter(condition.field));
  const fit = conditions.filter((condition) => isFitFilter(condition.field));

  if (stage.length > 0 && fit.length > 0) {
    return "Stage and fit filters";
  }

  if (stage.length > 0) {
    return buildFocusedFilterLabel("Stage filters", stage);
  }

  if (fit.length > 0) {
    return buildFocusedFilterLabel("Fit filters", fit);
  }

  return null;
}

function buildFocusedFilterLabel(base: string, conditions: FilterCondition[]) {
  if (conditions.length === 0) {
    return base;
  }

  const focus = conditions
    .slice(0, 2)
    .map((condition) => describeConditionFocus(condition))
    .filter(Boolean)
    .join(", ");

  return focus ? `${base}: ${focus}` : base;
}

function describeConditionFocus(condition: FilterCondition) {
  const field = condition.field.toLowerCase();

  if (
    field.includes("industry") ||
    field.includes("country") ||
    field.includes("location") ||
    field.includes("title") ||
    field.includes("funding")
  ) {
    return describeConditionValue(condition);
  }

  if (field.includes("headcount")) {
    return `team ${describeConditionValue(condition)}`;
  }

  if (field.includes("hiring") || field.includes("job_openings")) {
    return "active hiring";
  }

  return null;
}

function describeConditionValue(condition: FilterCondition) {
  if (Array.isArray(condition.value)) {
    return condition.value.join("/");
  }

  return String(condition.value);
}

function buildOutputFieldSummary(workflow: WorkflowSpec | ValidatedWorkflowSpec) {
  if (workflow.entityType === "person") {
    return "candidate name, current title, current company, location, contact coverage, and fit signals";
  }

  if (workflow.uiIntent === "comparison-view") {
    return "company name, HQ, industry, funding stage, hiring activity, and headcount side by side";
  }

  return "company name, domain, HQ, industry, funding stage, hiring activity, headcount, and research notes";
}

function isStageFilter(field: string) {
  const normalized = field.toLowerCase();
  return (
    normalized.includes("funding") ||
    normalized.includes("headcount") ||
    normalized.includes("job_openings") ||
    normalized.includes("hiring")
  );
}

function isFitFilter(field: string) {
  const normalized = field.toLowerCase();
  return (
    normalized.includes("industry") ||
    normalized.includes("country") ||
    normalized.includes("location") ||
    normalized.includes("title") ||
    normalized.includes("skill")
  );
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

function preserveRemovedStepTypes(
  baseSteps: WorkflowStep[],
  latestSteps: WorkflowStep[],
) {
  const latestTypes = new Set(latestSteps.map((step) => step.type));

  return baseSteps.filter((step) => {
    if (!["filter", "enrich", "analyze", "output"].includes(step.type)) {
      return true;
    }

    return latestTypes.has(step.type);
  });
}

function applyPromptStepEdits(
  prompt: string,
  nextSteps: WorkflowStep[],
  matchSource: WorkflowStep[],
) {
  const removals = findRemovedSteps(prompt, matchSource);
  if (removals.length === 0) {
    return nextSteps;
  }

  return nextSteps.filter(
    (step) => !removals.some((candidate) => isSameStep(candidate, step)),
  );
}

function findRemovedSteps(prompt: string, steps: WorkflowStep[]) {
  const lower = normalizeStepText(prompt);
  const asksToRemove =
    lower.includes("remove") ||
    lower.includes("delete") ||
    lower.includes("drop") ||
    lower.includes("without");

  if (!asksToRemove) {
    return [];
  }

  const exactMatches = steps.filter((step) =>
    lower.includes(normalizeStepText(step.label)),
  );
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (
    lower.includes("research") ||
    lower.includes("analysis") ||
    lower.includes("analyze")
  ) {
    return steps.filter((step) => step.type === "analyze");
  }

  if (lower.includes("enrich")) {
    return steps.filter((step) => step.type === "enrich");
  }

  if (
    lower.includes("dashboard") ||
    lower.includes("report") ||
    lower.includes("output")
  ) {
    return steps.filter((step) => step.type === "output");
  }

  if (lower.includes("filter")) {
    return steps.filter((step) => step.type === "filter");
  }

  return [];
}

function isSameStep(left: WorkflowStep, right: WorkflowStep) {
  return (
    left.type === right.type &&
    normalizeStepText(left.label) === normalizeStepText(right.label)
  );
}

function normalizeStepText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
