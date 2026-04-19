import type { Spec } from "@json-render/core";
import type { RunResult } from "@/lib/workflow/schema";

export function buildFallbackRunSpec(run: RunResult | null): Spec | null {
  if (!run) {
    return defaultIdleSpec;
  }

  const warningIds = run.warnings.map((_, index) => `warning-${index}`);
  const segmentData = run.derivedInsights.segments
    .map((segment) => ({
      label: segment.label,
      value: Number(segment.value.replace(/[^\d.]/g, "")) || segment.value.length,
    }))
    .slice(0, 5);

  const rootChildren = [
    "header",
    ...warningIds,
    "metrics",
    "pipeline",
    "insights",
    "records",
    "detail",
    "actions",
  ].filter(Boolean);

  const elements: Spec["elements"] = {
    root: {
      type: "Stack",
      props: { gap: "lg" },
      children: rootChildren,
    },
    header: {
      type: "Header",
      props: {
        eyebrow: "Latest run",
        title: run.derivedInsights.title,
        description: run.derivedInsights.summary,
      },
    },
    metrics: {
      type: "MetricStrip",
      props: {
        items: [
          { label: "Input", value: String(run.counts.input) },
          { label: "Enriched", value: String(run.counts.enriched) },
          { label: "Derived", value: String(run.counts.derived) },
        ],
      },
    },
    pipeline: {
      type: "SectionCard",
      props: {
        title: "Pipeline summary",
        description: "Normalized workflow stages and execution status for the latest run.",
      },
      children: ["pipeline-steps", "pipeline-tags"],
    },
    "pipeline-steps": {
      type: "PipelineTimeline",
      props: {
        steps: [
          { label: "Input normalized", status: "done", description: "Prompt and local source were mapped into a WorkflowSpec." },
          {
            label: run.status === "failed" ? "Execution blocked" : "CrustData enrichment",
            status: run.status === "failed" ? "warning" : "done",
            description: run.warnings[0] ?? "Records were enriched or mocked through the workflow executor.",
          },
          {
            label: "Derived insights",
            status: "done",
            description: "Local derivation summarized highlights and recommendations for the UI.",
          },
        ],
      },
    },
    "pipeline-tags": {
      type: "TagBar",
      props: {
        title: "Warnings and mode",
        tags: [run.status, ...run.warnings.slice(0, 5)].filter(Boolean),
      },
    },
    insights: {
      type: "SectionCard",
      props: {
        title: "Insights",
        description: "Top highlights, recommendations, and rollups derived from the result set.",
      },
      children: segmentData.length > 0 ? ["highlights", "chart"] : ["highlights"],
    },
    highlights: {
      type: "RankedList",
      props: {
        title: "Highlights",
        items: [
          ...run.derivedInsights.highlights.map((item) => ({ label: item })),
          ...run.derivedInsights.recommendations.slice(0, 2).map((item) => ({
            label: item,
            value: "recommendation",
          })),
        ].slice(0, 6),
      },
    },
    records: {
      type: "RecordTable",
      props: {
        title: "Record preview",
        caption: "Trimmed preview of the latest run payload stored in-browser.",
        columns: ["Input", "Entity", "Source", "Derived"],
        rows: run.records.slice(0, 8).map((record) => [
          record.inputKey,
          record.entityType,
          record.sourceHint,
          summarizeDerived(record.derivedPayload),
        ]),
      },
    },
    detail: {
      type: "EntityDetail",
      props: {
        title: "First record detail",
        fields: buildDetailFields(run),
      },
    },
    actions: {
      type: "CTAGroup",
      props: {
        title: "Suggested next moves",
        buttons: [
          { label: "Refine in chat" },
          { label: "Export locally" },
          { label: "Pivot workflow" },
        ],
      },
    },
  };

  if (segmentData.length > 0) {
    elements.chart = {
      type: "BarChart",
      props: {
        title: "Derived segment signal",
        data: segmentData,
      },
    };
  }

  for (const [index, warning] of run.warnings.entries()) {
    elements[`warning-${index}`] = {
      type: "Notice",
      props: {
        title: "Workflow warning",
        body: warning,
        tone: "warning",
      },
    };
  }

  return {
    root: "root",
    elements,
  };
}

const defaultIdleSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "Stack",
      props: { gap: "lg" },
      children: ["header", "notice", "actions"],
    },
    header: {
      type: "Header",
      props: {
        eyebrow: "Canvas idle",
        title: "Your generated app will appear here.",
        description:
          "The shell is already wired to accept chat-driven workflows. The next successful run will stream text into chat and render a structured UI in this canvas.",
      },
    },
    notice: {
      type: "Notice",
      props: {
        title: "Best first prompt",
        body: "Try asking for a prospecting workspace, recruiting scout, founder research dashboard, or CSV-to-enrichment flow.",
        tone: "neutral",
      },
    },
    actions: {
      type: "CTAGroup",
      props: {
        title: "Suggested prompts",
        buttons: [
          { label: "Prospect list" },
          { label: "Candidate scout" },
          { label: "Company monitor" },
        ],
      },
    },
  },
};

function buildDetailFields(run: RunResult) {
  const first = run.records[0];
  if (!first) {
    return [
      { label: "Status", value: "No records yet" },
      { label: "Hint", value: "Run a workflow from the chat panel." },
    ];
  }

  return [
    { label: "Input key", value: first.inputKey },
    { label: "Entity type", value: first.entityType },
    { label: "Source hint", value: first.sourceHint },
    { label: "Derived", value: summarizeDerived(first.derivedPayload) },
  ];
}

function summarizeDerived(payload: Record<string, unknown> | null) {
  if (!payload) {
    return "No derived payload";
  }

  const value = payload.summary ?? payload.rationale ?? payload.score ?? payload.recommendation;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return Object.keys(payload).slice(0, 3).join(", ") || "Derived fields available";
}
