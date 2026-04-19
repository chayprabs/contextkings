import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getOpenAIModel, getOpenAIReasoningEffort } from "@/lib/openai/config";
import {
  workflowSpecSchema,
  type FilterCondition,
  type FilterGroup,
  type SourceContext,
  type ThreadState,
  type WorkflowSpec,
} from "@/lib/workflow/schema";

const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const LINKEDIN_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/gi;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const REFINEMENT_KEYWORDS = [
  "refine",
  "refinement",
  "adjust",
  "change",
  "update",
  "improve",
  "make",
  "fix",
  "add",
  "more",
  "another",
  "detailed",
  "detail",
  "remove",
];
const WORKFLOW_EDIT_TARGETS = [
  "filter",
  "filters",
  "stage",
  "fit",
  "step",
  "steps",
  "shortlist",
  "output",
  "dashboard",
  "report",
  "table",
  "card",
];

export async function draftWorkflowFromPrompt(
  prompt: string,
  threadState: ThreadState,
  sourceContext?: SourceContext | null,
) {
  const fallback = heuristicWorkflowFromPrompt(prompt, threadState, sourceContext);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  try {
    const result = await generateObject({
      model: openai(getOpenAIModel()),
      schema: workflowSpecSchema,
      temperature: 0,
      providerOptions: {
        openai: {
          reasoningEffort: getOpenAIReasoningEffort(),
        },
      },
      system: [
        "You are compiling natural-language requests into CrustData workflow specs.",
        "Always constrain the plan to supported CrustData workflows.",
        "If the user mentions unsupported live data sources, rewrite them into the closest supported flow and record that rewrite in assumptions.",
        "Prefer company/person enrich when identifiers are present and search when the request is exploratory.",
        "Use concise warnings for plan limits, missing identifiers, or rate-limit risks.",
      ].join(" "),
      prompt: [
        `User prompt:\n${prompt}`,
        `Latest workflow context:\n${JSON.stringify(threadState.latestWorkflow, null, 2)}`,
        `Latest run summary:\n${JSON.stringify(threadState.latestRun?.derivedInsights ?? null, null, 2)}`,
        `Local source context:\n${JSON.stringify(sourceContext ?? threadState.sourceContext, null, 2)}`,
      ].join("\n\n"),
    });

    return normalizeWorkflow(result.object, prompt, sourceContext ?? threadState.sourceContext, true);
  } catch {
    return fallback;
  }
}

export const LIVE_DEMO_WORKFLOW_PROMPT =
  "Test live company enrichment with real public domains openai.com, stripe.com, hubspot.com, and rippling.com. Build a comparison dashboard with hiring and funding context.";

export function listPromptChips() {
  return [
    LIVE_DEMO_WORKFLOW_PROMPT,
    "Build a prospect list dashboard for fintech companies in India and score them for outbound.",
    "Use LinkedIn profile URLs to create a recruiting scout for senior ML candidates.",
    "Turn a CSV of startup domains into a company research workspace with enrichment and ranking.",
    "Build an internal sales tool that enriches founders and highlights warm signals.",
  ];
}

export function heuristicWorkflowFromPrompt(
  prompt: string,
  threadState: ThreadState,
  sourceContext?: SourceContext | null,
): WorkflowSpec {
  const previousWorkflow = threadState.latestWorkflow;
  if (previousWorkflow && shouldTreatAsRefinement(prompt)) {
    return normalizeWorkflow(
      refineWorkflowFromPrompt(
        prompt,
        previousWorkflow,
        sourceContext ?? threadState.sourceContext ?? null,
      ),
      `${previousWorkflow.goal}\n${prompt}`.trim(),
      sourceContext,
      false,
    );
  }

  const inferredInputMode = inferInputMode(prompt, sourceContext);
  const inferredEntityType = inferEntityType(prompt, sourceContext);

  return normalizeWorkflow(
    {
      goal: prompt.trim(),
      inputMode: inferredInputMode,
      entityType: inferredEntityType,
      sourceHints: inferSourceHints(prompt, sourceContext),
      crustPlan: inferCrustPlan(prompt, sourceContext),
      llmTask: inferLlmTask(prompt),
      uiIntent: inferUiIntent(prompt),
      assumptions: inferAssumptions(prompt, threadState, sourceContext),
      warnings: inferWarnings(prompt, sourceContext),
      inputs: {
        limit: inferLimit(prompt),
        filters: inferFilters(prompt, inferredEntityType, inferredInputMode),
        identifiers: extractIdentifiers(prompt, sourceContext),
        manualEntries: extractManualEntries(sourceContext),
        sourceColumns: sourceContext?.records.length
          ? Object.keys(sourceContext.records[0] ?? {})
          : [],
      },
    },
    prompt,
    sourceContext,
    false,
  );
}

function normalizeWorkflow(
  candidate: WorkflowSpec,
  prompt: string,
  sourceContext?: SourceContext | null,
  includeGeneratedMarker?: boolean,
) {
  const normalized = workflowSpecSchema.parse(candidate);
  const assumptions = [...normalized.assumptions];
  const warnings = [...normalized.warnings];

  assumptions.unshift(
    includeGeneratedMarker
      ? "Workflow draft generated with structured output and normalized against local safeguards."
      : "Workflow draft generated with the local fallback planner because no model response was available.",
  );

  if (mentionsUnsupportedSource(prompt)) {
    assumptions.push("Unsupported or live connector language was mapped to the closest CrustData-compatible search/enrich path.");
  }

  if (sourceContext?.kind === "csv") {
    assumptions.push("CSV rows are treated as a bootstrap source and only enriched when usable identifiers are present.");
  }

  if (normalized.inputs.identifiers.length === 0 && sourceContext?.records.length === 0) {
    warnings.push("No direct identifiers were found, so search or mock execution may be used.");
  }

  return workflowSpecSchema.parse({
    ...normalized,
    assumptions: dedupe(assumptions),
    warnings: dedupe(warnings),
  });
}

function inferInputMode(prompt: string, sourceContext?: SourceContext | null): WorkflowSpec["inputMode"] {
  const lower = prompt.toLowerCase();
  const identifiers = extractIdentifiers(prompt, sourceContext);
  const entityType = inferEntityType(prompt, sourceContext);

  if (sourceContext?.kind === "csv" || lower.includes("csv")) {
    return "csv";
  }
  if (identifiers.length > 0) {
    return "manual-list";
  }
  if (lower.includes("web") || lower.includes("news") || lower.includes("website")) {
    return "web-search";
  }
  if (
    lower.includes("filter") ||
    lower.includes("filters") ||
    lower.includes("shortlist") ||
    lower.includes("stage") ||
    lower.includes("fit")
  ) {
    return entityType === "person" ? "person-search" : "company-search";
  }
  if (lower.includes("search") || lower.includes("find")) {
    return entityType === "person"
      ? "person-search"
      : "company-search";
  }
  if (
    entityType === "person" &&
    [
      "candidate",
      "candidates",
      "people",
      "person",
      "talent",
      "recruit",
      "recruiting",
      "hire",
      "hiring",
      "scout",
      "profiles",
    ].some((needle) => lower.includes(needle))
  ) {
    return "person-search";
  }
  if (
    entityType === "company" &&
    [
      "company",
      "companies",
      "startup",
      "startups",
      "competitor",
      "competitors",
      "prospect",
      "prospects",
      "outbound",
      "market",
      "monitor",
      "research",
    ].some((needle) => lower.includes(needle))
  ) {
    return "company-search";
  }
  return "manual-list";
}

function inferEntityType(prompt: string, sourceContext?: SourceContext | null): WorkflowSpec["entityType"] {
  const lower = prompt.toLowerCase();
  const sourceText = JSON.stringify(sourceContext ?? {}).toLowerCase();

  if (
    lower.includes("candidate") ||
    lower.includes("people") ||
    lower.includes("person") ||
    lower.includes("linkedin profile") ||
    sourceText.includes("linkedin.com/in") ||
    sourceText.includes("@")
  ) {
    return "person";
  }

  if (lower.includes("web") || lower.includes("news article")) {
    return "web-document";
  }

  return "company";
}

function inferCrustPlan(prompt: string, sourceContext?: SourceContext | null) {
  const entityType = inferEntityType(prompt, sourceContext);
  const inputMode = inferInputMode(prompt, sourceContext);
  const steps: WorkflowSpec["crustPlan"] = [];

  if (inputMode === "company-search") {
    steps.push({
      step: "company-search",
      endpoint: "/company/search",
      reason: "Discover candidate companies from structured filters before enriching them.",
    });
    steps.push({
      step: "company-enrich",
      endpoint: "/company/enrich",
      reason: "Enrich shortlisted company records before downstream ranking and UI rendering.",
    });
  } else if (inputMode === "person-search") {
    steps.push({
      step: "person-search",
      endpoint: "/person/search",
      reason: "Discover candidate people from structured filters before enriching them.",
    });
    steps.push({
      step: "person-enrich",
      endpoint: "/person/enrich",
      reason: "Enrich shortlisted profiles before scoring and UI generation.",
    });
  } else if (entityType === "person") {
    steps.push({
      step: "person-enrich",
      endpoint: "/person/enrich",
      reason: "Known people identifiers can go directly into enrich.",
    });
  } else if (entityType === "company") {
    steps.push({
      step: "company-enrich",
      endpoint: "/company/enrich",
      reason: "Known company identifiers can go directly into enrich.",
    });
  } else {
    steps.push({
      step: "web-search",
      endpoint: "/web/search",
      reason: "Web workflows are gated and only used when explicitly enabled.",
    });
  }

  steps.push({
    step: "llm-derive",
    reason: "Summarize and score the enriched dataset for the requested outcome.",
  });

  return steps;
}

function inferLlmTask(prompt: string): WorkflowSpec["llmTask"] {
  const lower = prompt.toLowerCase();
  if (lower.includes("score")) return "score";
  if (lower.includes("classify")) return "classify";
  if (lower.includes("cluster")) return "cluster";
  if (lower.includes("outreach")) return "draft-outreach";
  if (lower.includes("signal")) return "extract-signals";
  if (lower.includes("research")) return "research";
  if (lower.includes("rank") || lower.includes("top")) return "rank";
  return "summarize";
}

function inferUiIntent(prompt: string): WorkflowSpec["uiIntent"] {
  const lower = prompt.toLowerCase();
  if (lower.includes("report")) return "report";
  if (lower.includes("table")) return "table-first";
  if (lower.includes("card")) return "cards-first";
  if (lower.includes("compare")) return "comparison-view";
  if (lower.includes("list")) return "list";
  return "dashboard";
}

function inferSourceHints(prompt: string, sourceContext?: SourceContext | null) {
  const lower = prompt.toLowerCase();
  const hints = new Set<string>();

  if (lower.includes("linkedin")) hints.add("LinkedIn");
  if (lower.includes("csv") || sourceContext?.kind === "csv") hints.add("CSV");
  if (lower.includes("crm")) hints.add("CRM");
  if (lower.includes("domain")) hints.add("domain list");
  if (lower.includes("recruit")) hints.add("recruiting");
  if (lower.includes("sales")) hints.add("sales");
  if (lower.includes("news")) hints.add("web/news");
  if (hints.size === 0) hints.add("manual prompt");

  return [...hints];
}

function inferAssumptions(
  prompt: string,
  threadState: ThreadState,
  sourceContext?: SourceContext | null,
) {
  const assumptions: string[] = [];

  if (threadState.latestWorkflow) {
    assumptions.push("Previous thread workflow is available for follow-up refinements.");
  }

  if (sourceContext) {
    assumptions.push(`Using local ${sourceContext.kind} source context named "${sourceContext.label}".`);
  }

  if (
    prompt.toLowerCase().includes("stage") ||
    prompt.toLowerCase().includes("fit") ||
    prompt.toLowerCase().includes("filter")
  ) {
    assumptions.push("The shortlist should break stage and fit checks into separate workflow gates when possible.");
  }

  if (prompt.toLowerCase().includes("linkedin")) {
    assumptions.push("LinkedIn language is treated as a source hint and mapped to profile-URL or person-search workflows rather than a direct connector.");
  }

  return assumptions;
}

function inferWarnings(prompt: string, sourceContext?: SourceContext | null) {
  const warnings: string[] = [];
  const lower = prompt.toLowerCase();

  if (mentionsUnsupportedSource(prompt)) {
    warnings.push("Some requested sources sound live or unsupported, so execution may be constrained to supported CrustData inputs.");
  }

  if (lower.includes("web") || lower.includes("news")) {
    warnings.push("Web workflows are capability-gated until CRUSTDATA_ENABLE_WEB is enabled.");
  }

  if (sourceContext?.kind === "manual" && sourceContext.records.length > 0) {
    warnings.push("Manual list enrichment depends on recognizable domains, emails, or profile URLs.");
  }

  return warnings;
}

function inferFilters(
  prompt: string,
  entityType: WorkflowSpec["entityType"],
  inputMode: WorkflowSpec["inputMode"],
): WorkflowSpec["inputs"]["filters"] | undefined {
  if (inputMode !== "company-search" && inputMode !== "person-search") {
    return undefined;
  }

  const conditions: FilterCondition[] = [];
  const lower = prompt.toLowerCase();

  if (inputMode === "company-search") {
    const industry = findFirstMatch(lower, INDUSTRY_KEYWORDS);
    if (industry) {
      conditions.push({
        field: "taxonomy.professional_network_industry",
        type: "contains",
        value: industry,
      });
    }

    const country = findCountry(lower);
    if (country) {
      conditions.push({
        field: "hq_country",
        type: "=",
        value: country,
      });
    }

    const stage = findFirstMatch(lower, FUNDING_STAGE_KEYWORDS);
    if (stage) {
      conditions.push({
        field: "funding.last_funding_round_type",
        type: "=",
        value: stage,
      });
    }

    const headcountRange = findHeadcountRange(lower);
    if (headcountRange) {
      conditions.push({
        field: "headcount.total",
        type: ">=",
        value: headcountRange.min,
      });
      conditions.push({
        field: "headcount.total",
        type: "<=",
        value: headcountRange.max,
      });
    }

    if (
      lower.includes("hiring") ||
      lower.includes("actively hiring") ||
      lower.includes("job openings") ||
      lower.includes("open roles")
    ) {
      conditions.push({
        field: "job_openings.job_openings_count",
        type: ">=",
        value: 1,
      });
    }
  }

  if (inputMode === "person-search" || entityType === "person") {
    const titleKeyword = findFirstMatch(lower, PERSON_TITLE_KEYWORDS);
    if (titleKeyword) {
      conditions.push({
        field: "experience.employment_details.current.title",
        type: "contains",
        value: titleKeyword,
      });
    }
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return {
    operator: "and",
    conditions,
  };
}

function shouldTreatAsRefinement(prompt: string) {
  const lower = prompt.toLowerCase();
  const hasRefinementKeyword = REFINEMENT_KEYWORDS.some((needle) => lower.includes(needle));
  const targetsExistingWorkflow = WORKFLOW_EDIT_TARGETS.some((needle) => lower.includes(needle));
  const isShortFollowUp = prompt.trim().split(/\s+/).length <= 14;

  return (hasRefinementKeyword && targetsExistingWorkflow) || (targetsExistingWorkflow && isShortFollowUp);
}

function refineWorkflowFromPrompt(
  prompt: string,
  previousWorkflow: WorkflowSpec,
  sourceContext?: SourceContext | null,
): WorkflowSpec {
  const combinedPrompt = `${previousWorkflow.goal}\n${prompt}`.trim();
  const lower = prompt.toLowerCase();
  const refinedInputMode =
    previousWorkflow.entityType === "person" ? "person-search" : "company-search";
  const inferredFilters = inferFilters(
    combinedPrompt,
    previousWorkflow.entityType,
    refinedInputMode,
  );
  const wantsDetailedFilters =
    lower.includes("filter") ||
    lower.includes("filters") ||
    lower.includes("stage") ||
    lower.includes("fit") ||
    lower.includes("shortlist");
  const nextWorkflow = structuredClone(previousWorkflow);

  nextWorkflow.goal = wantsDetailedFilters
    ? `${previousWorkflow.goal} with a more detailed stage-and-fit filter sequence`
    : `${previousWorkflow.goal} (${prompt.trim()})`;
  nextWorkflow.sourceHints = dedupe([
    ...previousWorkflow.sourceHints,
    ...inferSourceHints(combinedPrompt, sourceContext),
  ]);
  nextWorkflow.assumptions = dedupe([
    ...previousWorkflow.assumptions,
    "Follow-up refinement requested a more detailed stage-and-fit filter breakdown.",
    `Applied follow-up refinement: ${prompt.trim()}.`,
  ]);
  nextWorkflow.warnings = dedupe([
    ...previousWorkflow.warnings,
    ...inferWarnings(combinedPrompt, sourceContext),
  ]);

  if (wantsDetailedFilters && previousWorkflow.entityType !== "web-document") {
    nextWorkflow.inputMode = refinedInputMode;
    nextWorkflow.crustPlan = inferCrustPlan(combinedPrompt, sourceContext);
  }

  if (
    lower.includes("report") ||
    lower.includes("table") ||
    lower.includes("dashboard") ||
    lower.includes("card") ||
    lower.includes("compare")
  ) {
    nextWorkflow.uiIntent = inferUiIntent(combinedPrompt);
  }

  if (
    lower.includes("score") ||
    lower.includes("rank") ||
    lower.includes("research") ||
    lower.includes("signal") ||
    lower.includes("classify") ||
    lower.includes("cluster")
  ) {
    nextWorkflow.llmTask = inferLlmTask(combinedPrompt);
  }

  nextWorkflow.inputs = {
    ...previousWorkflow.inputs,
    limit: /\b\d{1,2}\b/.test(prompt) ? inferLimit(combinedPrompt) : previousWorkflow.inputs.limit,
    filters: wantsDetailedFilters
      ? mergeFilters(previousWorkflow.inputs.filters, inferredFilters)
      : previousWorkflow.inputs.filters,
    identifiers: dedupe([
      ...previousWorkflow.inputs.identifiers,
      ...extractIdentifiers(combinedPrompt, sourceContext),
    ]),
    manualEntries:
      previousWorkflow.inputs.manualEntries.length > 0
        ? previousWorkflow.inputs.manualEntries
        : extractManualEntries(sourceContext),
    sourceColumns: sourceContext?.records.length
      ? Object.keys(sourceContext.records[0] ?? {})
      : previousWorkflow.inputs.sourceColumns,
  };

  return nextWorkflow;
}

function mergeFilters(
  base?: FilterCondition | FilterGroup,
  incoming?: FilterCondition | FilterGroup,
) {
  const nextConditions = [base, incoming].filter(Boolean) as Array<FilterCondition | FilterGroup>;

  if (nextConditions.length === 0) {
    return undefined;
  }

  if (nextConditions.length === 1) {
    return nextConditions[0];
  }

  const deduped = dedupe(
    nextConditions.map((condition) => JSON.stringify(condition)),
  ).map((value) => JSON.parse(value) as FilterCondition | FilterGroup);

  return {
    operator: "and",
    conditions: deduped,
  } satisfies FilterGroup;
}

function inferLimit(prompt: string) {
  const match = prompt.match(/\b(\d{1,2})\b/);
  const value = match ? Number(match[1]) : 8;
  return Math.max(3, Math.min(25, value));
}

function extractIdentifiers(prompt: string, sourceContext?: SourceContext | null) {
  const identifiers = [
    ...(prompt.match(DOMAIN_REGEX) ?? []),
    ...(prompt.match(LINKEDIN_REGEX) ?? []),
    ...(prompt.match(EMAIL_REGEX) ?? []),
  ];

  if (sourceContext?.records.length) {
    for (const row of sourceContext.records.slice(0, 20)) {
      for (const value of Object.values(row)) {
        if (typeof value !== "string") continue;
        if (
          containsPattern(value, DOMAIN_REGEX) ||
          containsPattern(value, LINKEDIN_REGEX) ||
          containsPattern(value, EMAIL_REGEX)
        ) {
          identifiers.push(value);
        }
      }
    }
  }

  return dedupe(identifiers.map((value) => value.trim()));
}

function extractManualEntries(sourceContext?: SourceContext | null) {
  if (!sourceContext) {
    return [];
  }

  if (sourceContext.kind === "manual") {
    return sourceContext.records.map((row) => row.value ?? "").filter(Boolean);
  }

  return sourceContext.records
    .flatMap((row) => Object.values(row))
    .filter(Boolean)
    .slice(0, 40);
}

function mentionsUnsupportedSource(prompt: string) {
  const lower = prompt.toLowerCase();
  return [
    "apollo",
    "salesforce",
    "hubspot",
    "scrape linkedin",
    "live linkedin",
    "twitter api",
    "x api",
  ].some((needle) => lower.includes(needle));
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function containsPattern(value: string, pattern: RegExp) {
  return new RegExp(pattern.source, pattern.flags.replace("g", "")).test(value);
}

function findFirstMatch(
  input: string,
  candidates: Readonly<Record<string, string>>,
) {
  for (const [needle, value] of Object.entries(candidates)) {
    if (input.includes(needle)) {
      return value;
    }
  }

  return null;
}

function findCountry(input: string) {
  return findFirstMatch(input, COUNTRY_KEYWORDS);
}

function findHeadcountRange(input: string) {
  const rangeMatch = input.match(/\b(\d{2,4})\s*(?:to|-)\s*(\d{2,4})\b/);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2]),
    };
  }

  const minimumMatch = input.match(/\b(?:over|above|at least|>=?)\s*(\d{2,4})\b/);
  if (minimumMatch && mentionsHeadcountTerms(input)) {
    return {
      min: Number(minimumMatch[1]),
      max: 100000,
    };
  }

  const maximumMatch = input.match(/\b(?:under|below|at most|<=?)\s*(\d{2,4})\b/);
  if (maximumMatch && mentionsHeadcountTerms(input)) {
    return {
      min: 1,
      max: Number(maximumMatch[1]),
    };
  }

  return null;
}

function mentionsHeadcountTerms(input: string) {
  return ["employee", "employees", "headcount", "team size"].some((needle) =>
    input.includes(needle),
  );
}

const INDUSTRY_KEYWORDS = {
  "b2b saas": "Software",
  saas: "Software",
  fintech: "Financial Services",
  climate: "Renewables & Environment",
  "vertical ai": "Artificial Intelligence",
  "ai infrastructure": "Artificial Intelligence",
  infrastructure: "Information Technology & Services",
  healthcare: "Hospital & Health Care",
  ecommerce: "Retail",
} as const;

const PERSON_TITLE_KEYWORDS = {
  "machine learning": "Machine Learning Engineer",
  "ml ": "Machine Learning Engineer",
  " ai ": "AI Engineer",
  engineer: "Engineer",
  engineering: "Engineer",
  founder: "Founder",
  revenue: "Revenue",
  growth: "Growth",
  sales: "Sales",
  recruiting: "Recruiter",
  recruiter: "Recruiter",
} as const;

const COUNTRY_KEYWORDS = {
  india: "India",
  usa: "USA",
  "united states": "USA",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  canada: "Canada",
  singapore: "Singapore",
  uae: "United Arab Emirates",
  europe: "Europe",
} as const;

const FUNDING_STAGE_KEYWORDS = {
  "pre-seed": "Pre-Seed",
  "pre seed": "Pre-Seed",
  seed: "Seed",
  "series a": "Series A",
  "series b": "Series B",
  "series c": "Series C",
  "growth stage": "Series B",
  "early stage": "Seed",
} as const;
