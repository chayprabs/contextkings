import type { Spec } from "@json-render/core";
import type { RecordEnvelope, RunResult } from "@/lib/workflow/schema";

type ChartDatum = {
  label: string;
  value: number;
};

type SegmentDatum = {
  label: string;
  value: number;
  description?: string;
};

type AnalyticsProgressItem = {
  label: string;
  value: number;
  note: string;
};

type AnalyticsDistributionItem = {
  label: string;
  value: number;
  note?: string;
};

type AnalyticsLeaderItem = {
  label: string;
  value: number;
  note?: string;
};

export function buildRunCanvasSpec(run: RunResult): Spec {
  const warningIds = run.warnings.map((_, index) => `warning-${index}`);
  const segmentData = buildSegmentData(run);
  const distribution = buildDistributionItems(run, segmentData);
  const leaderboard = buildLeaderboard(run, distribution);
  const signalChartId =
    segmentData.length > 0
      ? "signal-segments"
      : distribution.length > 0
        ? "signal-composition"
        : null;

  const elements: Spec["elements"] = {
    root: {
      type: "Stack",
      props: { gap: "lg" },
      children: [
        "analytics",
        ...warningIds,
        "metrics",
        "overview-grid",
        "records",
        "detail-grid",
      ],
    },
    analytics: {
      type: "AnalyticsDeck",
      props: buildAnalyticsDeckProps(run, distribution, leaderboard),
    },
    metrics: {
      type: "MetricStrip",
      props: {
        items: [
          {
            label: "Input",
            value: String(run.counts.input),
            hint: "Identifiers, rows, or seeds supplied to the workflow.",
          },
          {
            label: "Enriched",
            value: String(run.counts.enriched),
            hint: "Records hydrated with source or CrustData context.",
          },
          {
            label: "Derived",
            value: String(run.counts.derived),
            hint: "Rows that made it into the analytical output layer.",
          },
          {
            label: "Warnings",
            value: String(run.warnings.length),
            hint: run.warnings.length > 0 ? "Review blockers before trusting the run." : "No issues were attached to this run.",
          },
        ],
      },
    },
    "overview-grid": {
      type: "Grid",
      props: {
        variant: "split",
      },
      children: ["pipeline", "signals"],
    },
    pipeline: {
      type: "SectionCard",
      props: {
        title: "Pipeline narrative",
        description:
          "A quick read on how the run moved from source intake to rendered output.",
      },
      children: ["pipeline-steps", "pipeline-tags"],
    },
    "pipeline-steps": {
      type: "PipelineTimeline",
      props: {
        steps: [
          {
            label: "Source intake",
            status: run.counts.input > 0 ? "done" : "warning",
            description:
              run.counts.input > 0
                ? `Captured ${run.counts.input} starting identifier${run.counts.input === 1 ? "" : "s"} for normalization.`
                : "The run never received a usable input payload.",
          },
          {
            label: "Enrichment pass",
            status: run.counts.enriched > 0 ? "done" : run.status === "failed" ? "warning" : "active",
            description:
              run.counts.enriched > 0
                ? `${run.counts.enriched} record${run.counts.enriched === 1 ? "" : "s"} were enriched before analysis.`
                : run.warnings[0] ?? "No enriched records were available for downstream analysis.",
          },
          {
            label: "Insight generation",
            status: run.counts.derived > 0 ? "done" : run.status === "failed" ? "warning" : "active",
            description:
              run.counts.derived > 0
                ? `${run.counts.derived} record${run.counts.derived === 1 ? "" : "s"} produced derived insights for the dashboard.`
                : "The final analytical layer did not emit any structured records.",
          },
        ],
      },
    },
    "pipeline-tags": {
      type: "TagBar",
      props: {
        title: "Run markers",
        tags: [
          formatStatusLabel(run.status),
          `${run.records.length} record${run.records.length === 1 ? "" : "s"}`,
          `${run.derivedInsights.highlights.length} highlight${run.derivedInsights.highlights.length === 1 ? "" : "s"}`,
          ...run.warnings.slice(0, 2),
        ].filter(Boolean),
      },
    },
    signals: {
      type: "SectionCard",
      props: {
        title: "Signals and next moves",
        description:
          "The dashboard now carries visual summaries plus the clearest takeaways from the latest run.",
      },
      children: [
        ...(signalChartId ? [signalChartId] : []),
        "highlights",
        "recommendations",
      ],
    },
    highlights: {
      type: "RankedList",
      props: {
        title: "Highlights",
        items: buildHighlightItems(run),
      },
    },
    recommendations: {
      type: "RankedList",
      props: {
        title: "Recommended next moves",
        items: buildRecommendationItems(run),
      },
    },
    records: {
      type: "RecordTable",
      props: {
        title: "Record preview",
        caption:
          "Trimmed preview of the structured rows powering the rendered analytics canvas.",
        columns: ["Input", "Entity", "Source", "Derived"],
        rows: run.records.slice(0, 8).map((record) => [
          record.inputKey,
          record.entityType,
          record.sourceHint,
          summarizeDerived(record.derivedPayload),
        ]),
      },
    },
    "detail-grid": {
      type: "Grid",
      props: {
        variant: "split",
      },
      children: ["detail", "actions"],
    },
    detail: {
      type: "EntityDetail",
      props: {
        title: "Lead record detail",
        fields: buildDetailFields(run),
      },
    },
    actions: {
      type: "CTAGroup",
      props: {
        title: "Suggested next moves",
        buttons: [
          { label: "Refine filters" },
          { label: "Export records" },
          { label: "Switch view" },
        ],
      },
    },
  };

  if (signalChartId === "signal-segments") {
    elements["signal-segments"] = {
      type: "BarChart",
      props: {
        title: "Segment pressure",
        data: segmentData.map(({ label, value }) => ({ label, value })),
      },
    };
  }

  if (signalChartId === "signal-composition") {
    elements["signal-composition"] = {
      type: "BarChart",
      props: {
        title: "Dashboard composition",
        data: distribution.map(({ label, value }) => ({ label, value })),
      },
    };
  }

  for (const [index, warning] of run.warnings.entries()) {
    elements[`warning-${index}`] = {
      type: "Notice",
      props: {
        title: index === 0 ? "Workflow warning" : "Additional warning",
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

export function buildFallbackRunSpec(run: RunResult | null): Spec | null {
  if (!run) {
    return defaultIdleSpec;
  }

  return buildRunCanvasSpec(run);
}

function buildAnalyticsDeckProps(
  run: RunResult,
  distribution: AnalyticsDistributionItem[],
  leaderboard: {
    title: string;
    items: AnalyticsLeaderItem[];
  },
) {
  const readyCount = Math.max(run.counts.derived - run.counts.failed, 0);
  const completionRate = percent(readyCount, Math.max(run.counts.input, 1));
  const notes = [
    ...run.derivedInsights.highlights,
    ...run.derivedInsights.recommendations,
  ]
    .filter(Boolean)
    .slice(0, 4);

  return {
    title: run.derivedInsights.title,
    summary: run.derivedInsights.summary,
    status: formatStatusLabel(run.status),
    headlineLabel: "Completion rate",
    headlineValue: `${completionRate}%`,
    deltaLabel:
      readyCount > 0
        ? `${readyCount} ready for review`
        : run.status === "failed"
          ? `${run.counts.failed} blocked at execution`
          : "No finished records yet",
    deltaTone:
      run.status === "failed"
        ? "warning"
        : run.warnings.length > 0
          ? "neutral"
          : "positive",
    trend: buildStageTrend(run),
    progress: buildProgressItems(run),
    distributionTitle:
      run.derivedInsights.segments.length > 0
        ? "Segment mix"
        : "Workspace composition",
    distribution,
    leaderboardTitle: leaderboard.title,
    leaderboard: leaderboard.items,
    notes,
  };
}

function buildStageTrend(run: RunResult): ChartDatum[] {
  const input = Math.max(run.counts.input, run.records.length);
  const qualify =
    run.counts.enriched > 0
      ? Math.max(run.counts.enriched, Math.round((input + run.counts.enriched) / 2))
      : Math.max(input - run.counts.failed, 0);
  const enriched = run.counts.enriched;
  const derived = run.counts.derived;
  const ready = Math.max(run.counts.derived - run.counts.failed, 0);

  return [
    { label: "Input", value: input },
    { label: "Qualify", value: qualify },
    { label: "Enrich", value: enriched },
    { label: "Analyze", value: derived },
    { label: "Ready", value: ready },
  ];
}

function buildProgressItems(run: RunResult): AnalyticsProgressItem[] {
  const safeInput = Math.max(run.counts.input, 1);
  const safeEnriched = Math.max(run.counts.enriched, 1);

  return [
    {
      label: "Enrichment rate",
      value: percent(run.counts.enriched, safeInput),
      note:
        run.counts.input > 0
          ? `${run.counts.enriched}/${run.counts.input} inputs carried into enrichment`
          : "Waiting on a usable source payload",
    },
    {
      label: "Insight coverage",
      value: percent(run.counts.derived, safeEnriched),
      note:
        run.counts.enriched > 0
          ? `${run.counts.derived}/${run.counts.enriched} enriched rows made the final output`
          : "No enriched records were available for analysis",
    },
    {
      label: "Run health",
      value: computeRunHealth(run),
      note:
        run.warnings.length > 0
          ? `${run.warnings.length} warning${run.warnings.length === 1 ? "" : "s"} attached to the run`
          : "No warnings were attached to this execution",
    },
  ];
}

function buildDistributionItems(
  run: RunResult,
  segments: SegmentDatum[],
): AnalyticsDistributionItem[] {
  if (segments.length > 0) {
    return segments
      .slice(0, 5)
      .map((segment) => ({
        label: segment.label,
        value: segment.value,
        note: segment.description,
      }));
  }

  const fallback = [
    {
      label: "Records",
      value: Math.max(run.records.length, run.counts.derived),
      note: "Structured output",
    },
    {
      label: "Highlights",
      value: run.derivedInsights.highlights.length,
      note: "High-signal findings",
    },
    {
      label: "Recommendations",
      value: run.derivedInsights.recommendations.length,
      note: "Suggested actions",
    },
    {
      label: "Warnings",
      value: run.warnings.length > 0 ? run.warnings.length : run.status === "failed" ? 1 : 0,
      note: "Potential blockers",
    },
  ].filter((item) => item.value > 0);

  if (fallback.length > 0) {
    return fallback;
  }

  return [
    {
      label: "Output",
      value: 1,
      note: "Waiting for the first completed run",
    },
  ];
}

function buildLeaderboard(
  run: RunResult,
  distribution: AnalyticsDistributionItem[],
): {
  title: string;
  items: AnalyticsLeaderItem[];
} {
  const numericMetric = pickNumericMetric(run.records);

  if (numericMetric) {
    return {
      title: `Top ${humanizeKey(numericMetric.key)}`,
      items: numericMetric.items.slice(0, 4),
    };
  }

  if (run.records.length > 0) {
    return {
      title: "Priority board",
      items: run.records.slice(0, 4).map((record, index) => ({
        label: shortLabel(record.inputKey, 18),
        value: Math.max(run.records.length - index, 1),
        note: buildRecordNote(record),
      })),
    };
  }

  return {
    title: "Priority board",
    items: distribution.slice(0, 4).map((item) => ({
      label: item.label,
      value: item.value,
      note: item.note,
    })),
  };
}

function pickNumericMetric(records: RecordEnvelope[]) {
  const preferredKeys = [
    "score",
    "fitScore",
    "matchScore",
    "headcount",
    "employees",
    "hiring",
    "funding",
    "revenue",
  ];

  for (const key of preferredKeys) {
    const items = extractMetricItems(records, key);
    if (items.length >= 2) {
      return {
        key,
        items: items.sort((left, right) => right.value - left.value),
      };
    }
  }

  const derivedKeys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record.derivedPayload ?? {})) {
      derivedKeys.add(key);
    }
  }

  for (const key of derivedKeys) {
    const items = extractMetricItems(records, key);
    if (items.length >= 2) {
      return {
        key,
        items: items.sort((left, right) => right.value - left.value),
      };
    }
  }

  return null;
}

function extractMetricItems(
  records: RecordEnvelope[],
  key: string,
): AnalyticsLeaderItem[] {
  const items = records
    .map((record) => {
      const candidate =
        record.derivedPayload?.[key] ??
        record.crustPayload?.[key] ??
        record.rawSourceJson?.[key];
      const numeric = numericFromValue(candidate);

      if (numeric === null) {
        return null;
      }

      return {
        label: shortLabel(record.inputKey, 18),
        value: numeric,
        note: buildRecordNote(record),
      };
    })
    .filter(isDefined);

  return items;
}

function buildHighlightItems(run: RunResult) {
  const highlights =
    run.derivedInsights.highlights.length > 0
      ? run.derivedInsights.highlights
      : [run.derivedInsights.summary];

  return highlights.slice(0, 5).map((item) => ({
    label: item,
    value: "signal",
  }));
}

function buildRecommendationItems(run: RunResult) {
  const recommendations =
    run.derivedInsights.recommendations.length > 0
      ? run.derivedInsights.recommendations
      : [
          "Tighten the source payload or filters, then rerun the workflow.",
          "Export the current records if you want to inspect the raw output first.",
        ];

  return recommendations.slice(0, 4).map((item) => ({
    label: item,
    value: "next",
  }));
}

function buildSegmentData(run: RunResult): SegmentDatum[] {
  return run.derivedInsights.segments
    .map((segment) => ({
      label: shortLabel(segment.label, 22),
      value: numericFromValue(segment.value) ?? 0,
      description: segment.description,
    }))
    .filter((segment) => segment.value > 0)
    .slice(0, 5);
}

function buildDetailFields(run: RunResult) {
  const first = run.records[0];

  if (!first) {
    return [
      { label: "Status", value: "No records yet" },
      { label: "Hint", value: "Run a workflow from the planner to populate this panel." },
    ];
  }

  const derivedFields = Object.entries(first.derivedPayload ?? {})
    .filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }

      return typeof value !== "object";
    })
    .slice(0, 4)
    .map(([label, value]) => ({
      label: humanizeKey(label),
      value: String(value),
    }));

  return [
    { label: "Input key", value: first.inputKey },
    { label: "Entity type", value: first.entityType },
    { label: "Source hint", value: first.sourceHint },
    ...derivedFields,
  ].slice(0, 6);
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
          "The shell is ready for chat-driven workflows. The next successful run will render a graph-rich analytics canvas in this space.",
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

function percent(value: number, total: number) {
  return clampPercentage(Math.round((value / Math.max(total, 1)) * 100));
}

function computeRunHealth(run: RunResult) {
  const warningPenalty = run.warnings.length * 14;
  const failurePenalty = run.counts.failed * 22;
  const base =
    run.status === "failed"
      ? 24
      : run.status === "partial"
        ? 62
        : run.status === "mocked"
          ? 78
          : 92;

  return clampPercentage(base - warningPenalty - failurePenalty);
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function numericFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/(-?\d+(\.\d+)?)(\s*[kmb])?/i);
  if (!match) {
    return null;
  }

  let numeric = Number.parseFloat(match[1]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const suffix = match[3]?.trim().toLowerCase();
  if (suffix === "b") {
    numeric *= 1_000_000_000;
  } else if (suffix === "m") {
    numeric *= 1_000_000;
  } else if (suffix === "k") {
    numeric *= 1_000;
  }

  return numeric;
}

function summarizeDerived(payload: Record<string, unknown> | null) {
  if (!payload) {
    return "No derived payload";
  }

  const value =
    payload.summary ??
    payload.rationale ??
    payload.score ??
    payload.recommendation;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return Object.keys(payload).slice(0, 3).join(", ") || "Derived fields available";
}

function buildRecordNote(record: RecordEnvelope) {
  const value =
    record.derivedPayload?.summary ??
    record.derivedPayload?.industry ??
    record.derivedPayload?.title ??
    record.derivedPayload?.company;

  return typeof value === "string" ? value : record.sourceHint;
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase())
    .trim();
}

function shortLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatStatusLabel(status: RunResult["status"]) {
  switch (status) {
    case "completed":
      return "Completed";
    case "partial":
      return "Partial";
    case "failed":
      return "Failed";
    case "mocked":
      return "Mocked";
  }
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
