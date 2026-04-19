import type { UIMessage } from "ai";
import { getBrowserDb } from "@/lib/persistence/db";
import type { PlanMessage, WorkflowStep } from "@/lib/plan-mode";
import { runResultSchema, savedRunSummarySchema, sourceContextSchema, workflowSpecSchema, type RunResult, type SavedRunSummary, type SourceContext, type WorkflowSpec } from "@/lib/workflow/schema";

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
  workflow: WorkflowSpec | null;
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
};

type LoadedPlanThreadSnapshot = {
  messages: PlanMessage[];
  workflowSteps: WorkflowStep[];
  workflow: WorkflowSpec | null;
  latestRun: RunResult | null;
  sourceContext: SourceContext | null;
};

type MessageRow = {
  message_id: string;
  role: UIMessage["role"];
  parts_json: string;
};

type RunRow = {
  run_json: string;
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
      }

      if (input.latestRun) {
        await db.query(
          `insert into runs (run_id, thread_id, workflow_id, status, run_json, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (run_id)
           do update set status = excluded.status, run_json = excluded.run_json, updated_at = excluded.updated_at`,
          [
            input.latestRun.runId,
            input.threadId,
            input.latestRun.workflowId,
            input.latestRun.status,
            JSON.stringify(input.latestRun),
            input.latestRun.createdAt,
            now,
          ],
        );

        await db.query(`delete from records where run_id = $1`, [input.latestRun.runId]);
        for (const [index, record] of input.latestRun.records.entries()) {
          await db.query(
            `insert into records (id, run_id, entity_type, input_key, source_hint, raw_source_json, crust_json, derived_json)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              `${input.latestRun.runId}-${index}`,
              input.latestRun.runId,
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
      const workflowRows = await db.query(`select workflow_json from workflows where thread_id = $1`, [threadId]);
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
        ? parseNullableJson((workflowRows.rows[0] as WorkflowRow).workflow_json, workflowSpecSchema.parse)
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
            JSON.stringify({ content: message.content }),
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
        await db.query(
          `insert into runs (run_id, thread_id, workflow_id, status, run_json, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (run_id)
           do update set status = excluded.status, run_json = excluded.run_json, updated_at = excluded.updated_at`,
          [
            input.latestRun.runId,
            input.threadId,
            input.latestRun.workflowId,
            input.latestRun.status,
            JSON.stringify(input.latestRun),
            input.latestRun.createdAt,
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
      const workflowRows = await db.query(`select workflow_json from workflows where thread_id = $1`, [threadId]);
      const runRows = await db.query(
        `select run_json from runs where thread_id = $1 order by created_at desc`,
        [threadId],
      );

      const thread = threadRows.rows[0] as ThreadRow;
      const sourceContext = parseNullableJson(
        thread.source_context_json,
        sourceContextSchema.parse,
      );
      const messages = (messageRows.rows as MessageRow[]).map((row) => {
        const parsed = JSON.parse(row.parts_json) as { content?: string };
        return {
          id: row.message_id,
          role: row.role as PlanMessage["role"],
          content: parsed.content ?? "",
        };
      });

      const workflowPayload = workflowRows.rows[0]
        ? JSON.parse((workflowRows.rows[0] as WorkflowRow).workflow_json)
        : null;
      const workflow = workflowPayload?.workflow
        ? workflowSpecSchema.parse(workflowPayload.workflow)
        : workflowPayload
          ? workflowSpecSchema.parse(workflowPayload)
          : null;
      const workflowSteps = Array.isArray(workflowPayload?.workflowSteps)
        ? (workflowPayload.workflowSteps as WorkflowStep[])
        : [];
      const latestRun = runRows.rows[0]
        ? runResultSchema.parse(JSON.parse((runRows.rows[0] as RunRow).run_json))
        : null;

      return {
        messages,
        workflow,
        workflowSteps,
        latestRun,
        sourceContext,
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
