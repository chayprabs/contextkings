import { z } from "zod";
import { buildFallbackPlan, buildPlanAssistantMessage, detectViewType, syncWorkflowPlanSteps, type WorkflowStep } from "@/lib/plan-mode";
import { draftWorkflowFromPrompt } from "@/lib/workflow/planner";
import { createThreadStateSnapshot, sourceContextSchema, workflowSpecSchema } from "@/lib/workflow/schema";
import { validateWorkflowSpec } from "@/lib/workflow/validator";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().trim().min(1),
  latestSteps: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["source", "filter", "enrich", "analyze", "output"]),
      label: z.string(),
      description: z.string(),
      confirmed: z.boolean(),
    }),
  ).optional(),
  latestWorkflow: workflowSpecSchema.nullable().optional(),
  sourceContext: sourceContextSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());

  try {
    const draftedWorkflow = await draftWorkflowFromPrompt(
      body.prompt,
      createThreadStateSnapshot({
        latestWorkflow: body.latestWorkflow ?? null,
        sourceContext: body.sourceContext ?? null,
      }),
      body.sourceContext ?? null,
    );
    const workflow = validateWorkflowSpec(draftedWorkflow);
    const steps = syncWorkflowPlanSteps(
      workflow,
      body.prompt,
      body.latestSteps as WorkflowStep[] | undefined,
    );

    return Response.json({
      assistantMessage: buildPlanAssistantMessage(workflow, steps),
      steps,
      workflow,
      viewType: detectViewType(steps, workflow),
    });
  } catch {
    const fallback = buildFallbackPlan(body.prompt, body.sourceContext ?? null);
    const steps = syncWorkflowPlanSteps(
      fallback.workflow,
      body.prompt,
      body.latestSteps as WorkflowStep[] | undefined,
    );

    return Response.json({
      ...fallback,
      assistantMessage: buildPlanAssistantMessage(fallback.workflow, steps),
      steps,
      viewType: detectViewType(steps, fallback.workflow),
    });
  }
}
