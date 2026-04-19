import { z } from "zod";
import { buildFallbackPlan, buildPlanAssistantMessage, detectViewType, workflowToPlanSteps } from "@/lib/plan-mode";
import { draftWorkflowFromPrompt } from "@/lib/workflow/planner";
import { createThreadStateSnapshot, sourceContextSchema, workflowSpecSchema } from "@/lib/workflow/schema";
import { validateWorkflowSpec } from "@/lib/workflow/validator";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().trim().min(1),
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
    const steps = workflowToPlanSteps(workflow);

    return Response.json({
      assistantMessage: buildPlanAssistantMessage(workflow, steps),
      steps,
      workflow,
      viewType: detectViewType(steps, workflow),
    });
  } catch {
    return Response.json(buildFallbackPlan(body.prompt, body.sourceContext ?? null));
  }
}
