import { z } from "zod";
import { applyPlanStepsToWorkflow, createExecutionMetadata, detectViewType, workflowToPlanSteps } from "@/lib/plan-mode";
import { runWorkflow } from "@/lib/workflow/executor";
import { createThreadStateSnapshot, sourceContextSchema, validatedWorkflowSchema } from "@/lib/workflow/schema";

export const runtime = "nodejs";

const requestSchema = z.object({
  workflow: validatedWorkflowSchema,
  steps: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["source", "filter", "enrich", "analyze", "output"]),
      label: z.string(),
      description: z.string(),
      confirmed: z.boolean(),
    }),
  ),
  sourceContext: sourceContextSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());
  const startedAt = Date.now();
  const workflow = applyPlanStepsToWorkflow(body.workflow, body.steps);

  const run = await runWorkflow(
    workflow,
    createThreadStateSnapshot({
      latestWorkflow: workflow,
      sourceContext: body.sourceContext ?? null,
    }),
  );

  const steps = body.steps.length > 0 ? body.steps : workflowToPlanSteps(workflow);
  const viewType = detectViewType(steps, workflow);
  const durationMs = Date.now() - startedAt;

  return Response.json({
    run,
    viewType,
    metadata: createExecutionMetadata(run, viewType, durationMs),
  });
}
