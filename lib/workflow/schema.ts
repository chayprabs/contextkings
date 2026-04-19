import { z } from "zod";

export type FilterCondition = {
  field: string;
  type: "=" | "in" | "contains" | ">=" | "<=" | "=>" | "=<";
  value: string | number | boolean | string[] | number[];
};

export type FilterGroup = {
  operator: "and" | "or";
  conditions: Array<FilterCondition | FilterGroup>;
};

export const filterConditionSchema: z.ZodType<FilterCondition> = z.lazy(() =>
  z.object({
    field: z.string(),
    type: z.enum(["=", "in", "contains", ">=", "<=", "=>", "=<"]),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
    ]),
  }),
);

export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.object({
    operator: z.enum(["and", "or"]),
    conditions: z.array(z.union([filterConditionSchema, filterGroupSchema])),
  }),
);

export const sourceContextSchema = z.object({
  kind: z.enum(["manual", "csv"]),
  label: z.string(),
  content: z.string(),
  records: z.array(z.record(z.string(), z.string())).default([]),
});

export const workflowStepSchema = z.object({
  step: z.string(),
  endpoint: z.string().optional(),
  reason: z.string().optional(),
});

export const workflowInputsSchema = z.object({
  limit: z.number().int().min(1).max(25).default(8),
  filters: z.union([filterConditionSchema, filterGroupSchema]).optional(),
  identifiers: z.array(z.string()).default([]),
  manualEntries: z.array(z.string()).default([]),
  sourceColumns: z.array(z.string()).default([]),
});

export const workflowSpecSchema = z.object({
  goal: z.string(),
  inputMode: z.enum(["manual-list", "csv", "company-search", "person-search", "web-search"]),
  entityType: z.enum(["company", "person", "web-document", "mixed"]),
  sourceHints: z.array(z.string()).default([]),
  crustPlan: z.array(workflowStepSchema).min(1),
  llmTask: z.enum([
    "summarize",
    "score",
    "classify",
    "rank",
    "cluster",
    "draft-outreach",
    "extract-signals",
    "research",
  ]),
  uiIntent: z.enum(["dashboard", "list", "report", "table-first", "cards-first", "comparison-view"]),
  assumptions: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  inputs: workflowInputsSchema.default({
    limit: 8,
    identifiers: [],
    manualEntries: [],
    sourceColumns: [],
  }),
});

export const validatedWorkflowSchema = workflowSpecSchema.extend({
  resolvedEndpoints: z.array(z.string()).default([]),
  fieldSelections: z.record(z.string(), z.array(z.string())).default({}),
  executionMode: z.enum(["live", "mock"]).default("mock"),
  webEnabled: z.boolean().default(false),
});

export const recordEnvelopeSchema = z.object({
  entityType: z.enum(["company", "person", "web-document", "mixed"]),
  inputKey: z.string(),
  sourceHint: z.string(),
  rawSourceJson: z.record(z.string(), z.unknown()).nullable().default(null),
  crustPayload: z.record(z.string(), z.unknown()).nullable().default(null),
  derivedPayload: z.record(z.string(), z.unknown()).nullable().default(null),
});

export const derivedInsightsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  segments: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }),
  ).default([]),
});

export const runResultSchema = z.object({
  runId: z.string(),
  workflowId: z.string(),
  status: z.enum(["completed", "partial", "failed", "mocked"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  counts: z.object({
    input: z.number().int(),
    enriched: z.number().int(),
    derived: z.number().int(),
    failed: z.number().int(),
  }),
  warnings: z.array(z.string()).default([]),
  records: z.array(recordEnvelopeSchema),
  derivedInsights: derivedInsightsSchema,
  uiModel: z.unknown().nullable(),
});

export const savedRunSummarySchema = z.object({
  runId: z.string(),
  workflowId: z.string(),
  status: z.enum(["completed", "partial", "failed", "mocked"]),
  title: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  recordCount: z.number().int(),
});

export const threadStateSchema = z.object({
  latestWorkflow: workflowSpecSchema.nullable().default(null),
  latestRun: runResultSchema.nullable().default(null),
  savedRuns: z.array(savedRunSummarySchema).default([]),
  sourceContext: sourceContextSchema.nullable().default(null),
});

export type SourceContext = z.infer<typeof sourceContextSchema>;
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;
export type ValidatedWorkflowSpec = z.infer<typeof validatedWorkflowSchema>;
export type RecordEnvelope = z.infer<typeof recordEnvelopeSchema>;
export type RunResult = z.infer<typeof runResultSchema>;
export type SavedRunSummary = z.infer<typeof savedRunSummarySchema>;
export type ThreadState = z.infer<typeof threadStateSchema>;
export type ExportFormat = "csv" | "records-json" | "workflow-json";

export function createThreadStateSnapshot(input?: Partial<ThreadState>): ThreadState {
  return threadStateSchema.parse({
    latestWorkflow: null,
    latestRun: null,
    savedRuns: [],
    sourceContext: null,
    ...input,
  });
}
