import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getOpenAIModel, getOpenAIReasoningEffort } from "@/lib/openai/config";
import { workflowSpecSchema, type SourceContext, type ThreadState, type WorkflowSpec } from "@/lib/workflow/schema";

const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const LINKEDIN_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/gi;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

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
  return normalizeWorkflow(
    {
      goal: prompt.trim(),
      inputMode: inferInputMode(prompt, sourceContext),
      entityType: inferEntityType(prompt, sourceContext),
      sourceHints: inferSourceHints(prompt, sourceContext),
      crustPlan: inferCrustPlan(prompt, sourceContext),
      llmTask: inferLlmTask(prompt),
      uiIntent: inferUiIntent(prompt),
      assumptions: inferAssumptions(prompt, threadState, sourceContext),
      warnings: inferWarnings(prompt, sourceContext),
      inputs: {
        limit: inferLimit(prompt),
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
  if (sourceContext?.kind === "csv" || lower.includes("csv")) {
    return "csv";
  }
  if (lower.includes("web") || lower.includes("news") || lower.includes("website")) {
    return "web-search";
  }
  if (lower.includes("search") || lower.includes("find")) {
    return lower.includes("candidate") || lower.includes("people")
      ? "person-search"
      : "company-search";
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
          DOMAIN_REGEX.test(value) ||
          LINKEDIN_REGEX.test(value) ||
          EMAIL_REGEX.test(value)
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
