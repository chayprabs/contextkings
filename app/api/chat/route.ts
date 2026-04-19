import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateId, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { pipeJsonRender } from "@json-render/core";
import { getOpenAIModel, getOpenAIReasoningEffort } from "@/lib/openai/config";
import { contextKingsCatalog } from "@/lib/ui/catalog";
import { runWorkflow } from "@/lib/workflow/executor";
import { draftWorkflowFromPrompt } from "@/lib/workflow/planner";
import { createThreadStateSnapshot, runResultSchema, sourceContextSchema, threadStateSchema, validatedWorkflowSchema, workflowSpecSchema } from "@/lib/workflow/schema";
import { validateWorkflowSpec } from "@/lib/workflow/validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const messages = (body.messages ?? []) as UIMessage[];
  const sourceContext = body.sourceContext
    ? sourceContextSchema.parse(body.sourceContext)
    : null;
  const threadState = body.threadState
    ? threadStateSchema.parse(body.threadState)
    : createThreadStateSnapshot();

  if (!process.env.OPENAI_API_KEY) {
    return buildMissingKeyResponse(messages);
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai(getOpenAIModel()),
    system: buildSystemPrompt(),
    messages: modelMessages,
    stopWhen: stepCountIs(6),
    providerOptions: {
      openai: {
        reasoningEffort: getOpenAIReasoningEffort(),
      },
    },
    tools: {
      draftWorkflow: tool({
        description: "Compile the latest user intent into a constrained WorkflowSpec.",
        inputSchema: workflowSpecSchema.pick({
          goal: true,
          inputMode: true,
          entityType: true,
          sourceHints: true,
          crustPlan: true,
          llmTask: true,
          uiIntent: true,
          assumptions: true,
          warnings: true,
          inputs: true,
        }).partial().extend({
          prompt: workflowSpecSchema.shape.goal,
        }),
        execute: async ({ prompt }) => {
          const workflow = await draftWorkflowFromPrompt(
            prompt,
            threadState,
            sourceContext,
          );
          return { workflow };
        },
      }),
      validateWorkflow: tool({
        description: "Validate and normalize a WorkflowSpec against the supported CrustData capabilities.",
        inputSchema: workflowSpecSchema,
        execute: async (input) => {
          const workflow = validateWorkflowSpec(input);
          return { workflow };
        },
      }),
      runWorkflow: tool({
        description: "Execute a validated workflow and return a normalized RunResult with derived UI data.",
        inputSchema: validatedWorkflowSchema,
        execute: async (input) => {
          const workflow = validatedWorkflowSchema.parse(input);
          const result = await runWorkflow(workflow, threadState);
          return runResultSchema.parse(result);
        },
      }),
      listSavedRuns: tool({
        description: "List saved runs already present in the local browser-backed thread state.",
        inputSchema: workflowSpecSchema.pick({ goal: true }).partial(),
        execute: async () => ({
          runs: threadState.savedRuns,
        }),
      }),
      getRun: tool({
        description: "Get the latest local run from the thread state.",
        inputSchema: workflowSpecSchema.pick({ goal: true }).partial(),
        execute: async () => ({
          run: threadState.latestRun,
        }),
      }),
      exportRun: tool({
        description: "Return the currently available export formats for the latest local run.",
        inputSchema: workflowSpecSchema.pick({ goal: true }).partial(),
        execute: async () => ({
          runId: threadState.latestRun?.runId ?? null,
          formats: ["csv", "records-json", "workflow-json"],
        }),
      }),
    },
  });

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.merge(
        pipeJsonRender(
          result.toUIMessageStream({
            originalMessages: messages,
          }),
        ),
      );
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Unknown chat error",
    generateId: () => generateId(),
  });

  return createUIMessageStreamResponse({ stream });
}

function buildSystemPrompt() {
  return [
    "You are ContextKings, a chat-first CrustData workflow compiler.",
    "Always be honest about supported versus unsupported sources.",
    "When the user asks for unsupported live connectors, explicitly say what you mapped it to.",
    "Use tools in this order when starting a new request: draftWorkflow, validateWorkflow, runWorkflow.",
    "When a run succeeds, explain what happened in clear product language, mention any warnings, and generate a clean app-style UI using the json-render catalog.",
    "Prefer dashboard-like outputs with tables, insight lists, pipeline summaries, tags, and metric strips.",
    contextKingsCatalog.prompt({
      mode: "inline",
      customRules: [
        "Treat the workspace shell as already existing. Only generate the inner app canvas.",
        "Use Stack as the root container.",
        "Prefer SectionCard for grouping and MetricStrip for top-level KPIs.",
        "Never invent components outside the catalog.",
      ],
    }),
  ].join("\n\n");
}

function buildMissingKeyResponse(messages: UIMessage[]) {
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: "missing-key" });
      writer.write({
        type: "text-delta",
        id: "missing-key",
        delta:
          "OPENAI_API_KEY is not configured. Add it to `.env.local` so ContextKings can compile prompts into workflows and stream the generated UI.",
      });
      writer.write({ type: "text-end", id: "missing-key" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
