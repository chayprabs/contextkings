import type { UIMessage } from "ai";
import { getBrowserDb } from "@/lib/persistence/db";
import type { PlanMessage, SavedRun, WorkflowStep } from "@/lib/plan-mode";
import { validateWorkflowSpec } from "@/lib/workflow/validator";
import {
  runResultSchema,
  savedRunSummarySchema,
  sourceContextSchema,
  validatedWorkflowSchema,
  workflowSpecSchema,
  type RunResult,
  type SavedRunSummary,
  type SourceContext,
  type ValidatedWorkflowSpec,
  type WorkflowSpec,
} from "@/lib/workflow/schema";

export type PersistedThreadSnapshot = {
  threadId: string;
  messages: UIMessage[];
  workflow: WorkflowSpec | null;
  runs: SavedRunSummary[];
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
};

type LoadedThreadSnapshot = {
  messages: UIMessage[];
  workflow: WorkflowSpec | null;
  runs: SavedRunSummary[];
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
};

export type PersistedPlanThreadSnapshot = {
  threadId: string;
  messages: PlanMessage[];
  workflowSteps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec | null;
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
  savedRuns: SavedRun[];
};

type LoadedPlanThreadSnapshot = {
  messages: PlanMessage[];
  workflowSteps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec | null;
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
  savedRuns: SavedRun[];
};

type MessageRow = {
  message_id: string;
  role: UIMessage["role"];
  parts_json: string;
};

type RunRow = {
  run_json: string;
};

type PlanRunRow = {
  run_json: string;
  content_json: string | null;
};

type ThreadRow = {
  source_context_json: string | null;
};

type WorkflowRow = {
  workflow_json: string;
};

export async function getPersistenceRepository() {
  const db = await getBrowserDb();

  return {
    async saveThread(input: PersistedThreadSnapshot) {
      const now = new Date().toISOString();
      await db.query(
        `insert into threads (id, title, source_context_json, updated_at)
         values ($1, $2, $3, $4)
         on conflict (id)
         do update set title = excluded.title, source_context_json = excluded.source_context_json, updated_at = excluded.updated_at`,
        [
          input.threadId,
          input.workflow?.goal ?? "ContextKings thread",
          stringifyNullableJson(input.sourceContext),
          now,
        ],
      );

      await db.query(`delete from messages where thread_id = $1`, [input.threadId]);
      for (const [index, message] of input.messages.entries()) {
        await db.query(
          `insert into messages (message_id, thread_id, message_order, role, parts_json, created_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            message.id,
            input.threadId,
            index,
            message.role,
            JSON.stringify(message.parts),
            now,
          ],
        );
      }

      if (input.workflow) {
        await db.query(
          `insert into workflows (thread_id, workflow_json, updated_at)
           values ($1, $2, $3)
           on conflict (thread_id)
           do update set workflow_json = excluded.workflow_json, updated_at = excluded.updated_at`,
          [input.threadId, JSON.stringify(input.workflow), now],
        );
      } else {
        await db.query(`delete from workflows where thread_id = $1`, [input.threadId]);
      }

      if (input.latestRun) {
        await upsertRun(db, input.threadId, input.latestRun, now);
        await persistRunRecords(db, input.latestRun);
      }
    },

    async loadThread(threadId: string): Promise<LoadedThreadSnapshot | null> {
      const threadRows = await db.query(`select * from threads where id = $1`, [threadId]);
      if (threadRows.rows.length === 0) {
        return null;
      }

      const messageRows = await db.query(
        `select * from messages where thread_id = $1 order by message_order asc`,
        [threadId],
      );
      const workflowRows = await db.query(
        `select workflow_json from workflows where thread_id = $1`,
        [threadId],
      );
      const runRows = await db.query(
        `select run_json from runs where thread_id = $1 order by created_at desc`,
        [threadId],
      );

      const thread = threadRows.rows[0] as ThreadRow;
      const sourceContext = parseNullableJson(
        thread.source_context_json,
        sourceContextSchema.parse,
      );
      const messages = (messageRows.rows as MessageRow[]).map((row) => ({
        id: row.message_id,
        role: row.role,
        parts: JSON.parse(row.parts_json),
      })) as UIMessage[];
      const workflow = workflowRows.rows[0]
        ? parseNullableJson(
            (workflowRows.rows[0] as WorkflowRow).workflow_json,
            workflowSpecSchema.parse,
          )
        : null;
      const runs = (runRows.rows as RunRow[]).map((row) => {
        const run = runResultSchema.parse(JSON.parse(row.run_json));
        return savedRunSummarySchema.parse({
          runId: run.runId,
          workflowId: run.workflowId,
          status: run.status,
          title: run.derivedInsights.title,
          summary: run.derivedInsights.summary,
          createdAt: run.createdAt,
          recordCount: run.counts.enriched,
        });
      });
      const latestRun = runRows.rows[0]
        ? runResultSchema.parse(JSON.parse((runRows.rows[0] as RunRow).run_json))
        : null;

      return {
        messages,
        workflow,
        runs,
        latestRun,
        sourceContext,
      };
    },

    async getRun(runId: string): Promise<RunResult | null> {
      const rows = await db.query(`select run_json from runs where run_id = $1`, [runId]);
      if (rows.rows.length === 0) {
        return null;
      }

      return runResultSchema.parse(JSON.parse((rows.rows[0] as RunRow).run_json));
    },

    async savePlanThread(input: PersistedPlanThreadSnapshot) {
      const now = new Date().toISOString();
      await db.query(
        `insert into threads (id, title, source_context_json, updated_at)
         values ($1, $2, $3, $4)
         on conflict (id)
         do update set title = excluded.title, source_context_json = excluded.source_context_json, updated_at = excluded.updated_at`,
        [
          input.threadId,
          input.workflow?.goal ?? "ContextKings planner",
          stringifyNullableJson(input.sourceContext),
          now,
        ],
      );

      await db.query(`delete from messages where thread_id = $1`, [input.threadId]);
      for (const [index, message] of input.messages.entries()) {
        await db.query(
          `insert into messages (message_id, thread_id, message_order, role, parts_json, created_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            message.id,
            input.threadId,
            index,
            message.role,
            JSON.stringify({
              content: message.content,
              attachment: message.attachment ?? null,
            }),
            now,
          ],
        );
      }

      if (input.workflow) {
        await db.query(
          `insert into workflows (thread_id, workflow_json, updated_at)
           values ($1, $2, $3)
           on conflict (thread_id)
           do update set workflow_json = excluded.workflow_json, updated_at = excluded.updated_at`,
          [
            input.threadId,
            JSON.stringify({
              workflow: input.workflow,
              workflowSteps: input.workflowSteps,
            }),
            now,
          ],
        );
      } else {
        await db.query(`delete from workflows where thread_id = $1`, [input.threadId]);
      }

      if (input.latestRun) {
        await upsertRun(db, input.threadId, input.latestRun, now);
        await persistRunRecords(db, input.latestRun);
      }

      const runsToPersist = input.savedRuns.some((run) => run.runId)
        ? input.savedRuns
        : input.latestRun
          ? [
              {
                id: input.latestRun.runId,
                runId: input.latestRun.runId,
                title: input.workflow?.goal ?? input.latestRun.derivedInsights.title,
                timestamp: Date.parse(input.latestRun.createdAt) || Date.now(),
                steps: input.workflowSteps,
                workflow: input.workflow,
                sourceContext: input.sourceContext,
              } satisfies SavedRun,
            ]
          : [];

      for (const run of runsToPersist) {
        if (!run.runId) {
          continue;
        }

        await db.query(
          `insert into artifacts (id, run_id, kind, content_json, created_at)
           values ($1, $2, $3, $4, $5)
           on conflict (id)
           do update set content_json = excluded.content_json, created_at = excluded.created_at`,
          [
            `artifact-${run.runId}-plan-run`,
            run.runId,
            "plan-run",
            JSON.stringify({
              id: run.id,
              title: run.title,
              steps: run.steps,
              workflow: run.workflow,
              sourceContext: run.sourceContext,
            }),
            now,
          ],
        );
      }
    },

    async loadPlanThread(threadId: string): Promise<LoadedPlanThreadSnapshot | null> {
      const threadRows = await db.query(`select * from threads where id = $1`, [threadId]);
      if (threadRows.rows.length === 0) {
        return null;
      }

      const messageRows = await db.query(
        `select * from messages where thread_id = $1 order by message_order asc`,
        [threadId],
      );
      const workflowRows = await db.query(
        `select workflow_json from workflows where thread_id = $1`,
        [threadId],
      );
      const runRows = await db.query(
        `select runs.run_json, artifacts.content_json
         from runs
         left join artifacts
           on artifacts.run_id = runs.run_id
          and artifacts.kind = 'plan-run'
         where runs.thread_id = $1
         order by runs.created_at desc`,
        [threadId],
      );

      const thread = threadRows.rows[0] as ThreadRow;
      const sourceContext = parseNullableJson(
        thread.source_context_json,
        sourceContextSchema.parse,
      );
      const messages = (messageRows.rows as MessageRow[]).map((row) => {
        const parsed = JSON.parse(row.parts_json) as {
          content?: string;
          attachment?: PlanMessage["attachment"];
        };
        return {
          id: row.message_id,
          role: row.role as PlanMessage["role"],
          content: parsed.content ?? "",
          attachment: parsed.attachment ?? null,
        };
      });

      const workflowPayload = workflowRows.rows[0]
        ? JSON.parse((workflowRows.rows[0] as WorkflowRow).workflow_json)
        : null;
      const workflow = workflowPayload?.workflow
        ? parseValidatedWorkflow(workflowPayload.workflow)
        : workflowPayload
          ? parseValidatedWorkflow(workflowPayload)
          : null;
      const workflowSteps = Array.isArray(workflowPayload?.workflowSteps)
        ? (workflowPayload.workflowSteps as WorkflowStep[])
        : [];
      const latestRun = runRows.rows[0]
        ? runResultSchema.parse(JSON.parse((runRows.rows[0] as PlanRunRow).run_json))
        : null;
      const savedRuns = (runRows.rows as PlanRunRow[]).map((row, index) => {
        const run = runResultSchema.parse(JSON.parse(row.run_json));
        const payload = row.content_json ? JSON.parse(row.content_json) : null;

        return {
          id: payload?.id ?? run.runId ?? `saved-run-${index}`,
          runId: run.runId,
          title: payload?.title ?? run.derivedInsights.title,
          timestamp: Date.parse(run.createdAt) || Date.now(),
          steps: Array.isArray(payload?.steps) ? (payload.steps as WorkflowStep[]) : [],
          workflow: payload?.workflow ? parseValidatedWorkflow(payload.workflow) : null,
          sourceContext: payload?.sourceContext
            ? sourceContextSchema.parse(payload.sourceContext)
            : null,
        } satisfies SavedRun;
      });

      return {
        messages,
        workflowSteps,
        workflow,
        latestRun,
        sourceContext,
        savedRuns,
      };
    },
  };
}

export function exportRunAsCsv(run: RunResult) {
  const headers = ["inputKey", "entityType", "sourceHint", "derived"];
  const lines = [headers.join(",")];

  for (const record of run.records) {
    const values = [
      record.inputKey,
      record.entityType,
      record.sourceHint,
      JSON.stringify(record.derivedPayload ?? {}),
    ].map(escapeCsv);
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export function exportRunAsJson(run: RunResult) {
  return JSON.stringify(run, null, 2);
}

async function upsertRun(
  db: Awaited<ReturnType<typeof getBrowserDb>>,
  threadId: string,
  run: RunResult,
  now: string,
) {
  await db.query(
    `insert into runs (run_id, thread_id, workflow_id, status, run_json, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (run_id)
     do update set status = excluded.status, run_json = excluded.run_json, updated_at = excluded.updated_at`,
    [
      run.runId,
      threadId,
      run.workflowId,
      run.status,
      JSON.stringify(run),
      run.createdAt,
      now,
    ],
  );
}

async function persistRunRecords(
  db: Awaited<ReturnType<typeof getBrowserDb>>,
  run: RunResult,
) {
  await db.query(`delete from records where run_id = $1`, [run.runId]);
  for (const [index, record] of run.records.entries()) {
    await db.query(
      `insert into records (id, run_id, entity_type, input_key, source_hint, raw_source_json, crust_json, derived_json)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        `${run.runId}-${index}`,
        run.runId,
        record.entityType,
        record.inputKey,
        record.sourceHint,
        JSON.stringify(record.rawSourceJson),
        JSON.stringify(record.crustPayload),
        JSON.stringify(record.derivedPayload),
      ],
    );
  }
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

function parseNullableJson<T>(value: string | null, parse: (candidate: unknown) => T) {
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value);
  if (parsed === null) {
    return null;
  }

  return parse(parsed);
}

function stringifyNullableJson(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function parseValidatedWorkflow(value: unknown) {
  const validated = validatedWorkflowSchema.safeParse(value);
  if (validated.success) {
    return validated.data;
  }

  return validateWorkflowSpec(workflowSpecSchema.parse(value));
}
