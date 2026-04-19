"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileText,
  Filter,
  Layers,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { createExecutionBlockerMessage, hasExecutablePlanSteps, type PlanMessage, type WorkflowStep } from "@/lib/plan-mode";
import type { SourceContext, ValidatedWorkflowSpec } from "@/lib/workflow/schema";

export type { WorkflowStep } from "@/lib/plan-mode";

interface PlanScreenProps {
  error?: string | null;
  isHydrating?: boolean;
  messages: PlanMessage[];
  onClearSource: () => void;
  workflowSteps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec | null;
  onPlanChange: (input: {
    messages: PlanMessage[];
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec | null;
  }) => void;
  onExecutePlan: (input: {
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec;
  }) => void;
  onSaveManualSource: () => void;
  onSourceDraftChange: (value: string) => void;
  onSourceUpload: (file: File) => Promise<void>;
  sourceContext: SourceContext | null;
  sourceDraft: string;
}

const STARTER_PROMPTS = [
  "Research B2B SaaS companies in India for outbound",
  "Scout engineering candidates from LinkedIn profiles",
  "Compare 3 competitors in vertical AI infrastructure",
  "Monitor funding rounds for climate startups",
];

export function PlanScreen({
  error: repoError,
  isHydrating = false,
  messages,
  onClearSource,
  workflowSteps,
  workflow,
  onPlanChange,
  onExecutePlan,
  onSaveManualSource,
  onSourceDraftChange,
  onSourceUpload,
  sourceContext,
  sourceDraft,
}: PlanScreenProps) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasWorkflow = workflowSteps.length > 0;
  const canExecute = Boolean(workflow) && hasExecutablePlanSteps(workflowSteps);
  const executionBlocker = createExecutionBlockerMessage(workflowSteps);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, workflowSteps.length]);

  async function submitPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || isSubmitting) {
      return;
    }

    const nextUserMessage: PlanMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    const optimisticMessages = [...messages, nextUserMessage];

    setInput("");
    setIsSubmitting(true);
    setError(null);
    onPlanChange({
      messages: optimisticMessages,
      workflowSteps,
      workflow,
    });

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          latestWorkflow: workflow,
          sourceContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate the workflow plan.");
      }

      const payload = (await response.json()) as {
        assistantMessage: string;
        steps: WorkflowStep[];
        workflow: ValidatedWorkflowSpec;
      };

      onPlanChange({
        messages: [
          ...optimisticMessages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: payload.assistantMessage,
          },
        ],
        workflowSteps: payload.steps,
        workflow: payload.workflow,
      });
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to generate the workflow plan.";
      setError(message);
      onPlanChange({
        messages: [
          ...optimisticMessages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "I could not compile the workflow just now. Try refining the prompt or retrying the plan request.",
          },
        ],
        workflowSteps,
        workflow,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearPlan() {
    setInput("");
    setError(null);
    onPlanChange({
      messages: [],
      workflowSteps: [],
      workflow: null,
    });
  }

  function deleteStep(stepId: string) {
    const nextSteps = workflowSteps.filter((step) => step.id !== stepId);
    onPlanChange({
      messages,
      workflowSteps: nextSteps,
      workflow,
    });
  }

  return (
    <section className="min-h-screen bg-background text-foreground">
      <TopBar />

      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-7xl flex-col px-4 pb-6 pt-6 md:px-6">
        {!hasWorkflow ? (
          <div className="relative flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-3xl text-center">
              <h1 className="text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-6xl">
                What should we research?
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Describe your goal in plain language and ContextKings will turn it into a constrained workflow plan.
              </p>
            </div>

            <div className="mt-10 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-3xl border border-border bg-card p-5 text-left transition hover:border-foreground/25 hover:bg-card/80"
                  onClick={() => {
                    void submitPrompt(prompt);
                  }}
                  type="button"
                >
                  <div className="text-sm font-medium leading-6 text-foreground">
                    {prompt}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 w-full max-w-3xl">
              <SourcePanel
                onClearSource={onClearSource}
                onSaveManualSource={onSaveManualSource}
                onSourceDraftChange={onSourceDraftChange}
                onSourceUpload={onSourceUpload}
                sourceContext={sourceContext}
                sourceDraft={sourceDraft}
              />
            </div>

            {isHydrating ? (
              <div className="mt-4 text-sm text-muted-foreground">
                Restoring your local planner state...
              </div>
            ) : null}
            {repoError ? (
              <div className="mt-4 max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {repoError}
              </div>
            ) : null}

            <FloatingComposer
              disabled={isSubmitting}
              input={input}
              onChange={setInput}
              onSubmit={() => {
                void submitPrompt(input);
              }}
              placeholder="Describe what you want to build..."
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-border bg-background transition-all duration-300 md:flex-row">
            <div className="relative flex w-full flex-col border-b border-border pb-24 md:w-1/2 md:border-b-0 md:border-r">
              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="mx-auto flex h-full max-w-2xl flex-col gap-4">
                  <SourcePanel
                    compact
                    onClearSource={onClearSource}
                    onSaveManualSource={onSaveManualSource}
                    onSourceDraftChange={onSourceDraftChange}
                    onSourceUpload={onSourceUpload}
                    sourceContext={sourceContext}
                    sourceDraft={sourceDraft}
                  />
                  {isHydrating ? (
                    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      Restoring your local planner state...
                    </div>
                  ) : null}
                  {repoError ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {repoError}
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`max-w-[80%] ${
                        message.role === "user"
                          ? "ml-auto rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-background"
                          : "rounded-2xl px-1 py-1 text-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </div>
                    </article>
                  ))}
                  {error ? (
                    <div className="max-w-[80%] rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                      {error}
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>
              </div>

              <FloatingComposer
                disabled={isSubmitting}
                input={input}
                onChange={setInput}
                onSubmit={() => {
                  void submitPrompt(input);
                }}
                placeholder="Refine the workflow..."
              />
            </div>

            <aside className="w-full md:w-1/2">
              <div className="h-full px-5 py-5 md:px-6">
                <div className="flex h-full flex-col rounded-[28px] border border-border bg-card">
                  <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-base font-semibold tracking-[-0.03em] text-foreground">
                          Workflow Plan
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {workflowSteps.length} steps ready
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
                        onClick={clearPlan}
                        type="button"
                      >
                        Clear
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-90 disabled:opacity-50"
                        disabled={!canExecute}
                        onClick={() => {
                          if (!workflow) {
                            return;
                          }

                          onExecutePlan({
                            workflowSteps,
                            workflow,
                          });
                        }}
                        type="button"
                      >
                        <Play className="h-4 w-4" />
                        Execute plan
                      </button>
                    </div>
                  </div>

                  <div className="relative flex-1 overflow-y-auto px-5 py-5">
                    {executionBlocker ? (
                      <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                        {executionBlocker}
                      </div>
                    ) : null}
                    {workflowSteps.length > 1 ? (
                      <div className="absolute bottom-8 left-[27px] top-[32px] w-px bg-border" />
                    ) : null}

                    <div className="space-y-1">
                      {workflowSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className="group relative flex items-start gap-4 rounded-2xl px-1 py-2"
                        >
                          <div
                            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${stepColorClass(step.type)}`}
                          >
                            <StepIcon type={step.type} />
                          </div>

                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                              {step.type} #{index + 1}
                            </div>
                            <div className="mt-1 text-sm font-medium text-foreground">
                              {step.label}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-muted-foreground">
                              {step.description}
                            </div>
                          </div>

                          <button
                            aria-label={`Delete ${step.label}`}
                            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
                            onClick={() => deleteStep(step.id)}
                            type="button"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function TopBar() {
  return (
    <header className="relative flex h-12 items-center justify-center border-b border-border">
      <div className="text-sm tracking-[0.28em] text-foreground">ContextKings</div>
    </header>
  );
}

function FloatingComposer({
  input,
  disabled,
  onChange,
  onSubmit,
  placeholder,
}: {
  input: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  const isDisabled = disabled || input.trim().length === 0;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-4 pb-5 md:px-6">
      <div className="pointer-events-auto mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card shadow-lg shadow-black/20">
        <div className="relative">
          <input
            className="h-16 w-full rounded-2xl bg-transparent pl-5 pr-16 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            value={input}
          />
          <button
            className={`absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background transition ${
              isDisabled ? "opacity-20" : "opacity-100 hover:opacity-90"
            }`}
            disabled={isDisabled}
            onClick={onSubmit}
            type="button"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SourcePanel({
  compact = false,
  onClearSource,
  onSaveManualSource,
  onSourceDraftChange,
  onSourceUpload,
  sourceContext,
  sourceDraft,
}: {
  compact?: boolean;
  onClearSource: () => void;
  onSaveManualSource: () => void;
  onSourceDraftChange: (value: string) => void;
  onSourceUpload: (file: File) => Promise<void>;
  sourceContext: SourceContext | null;
  sourceDraft: string;
}) {
  return (
    <div className={`rounded-3xl border border-border bg-card ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Optional local source
          </div>
          <div className="mt-1 text-sm leading-6 text-foreground">
            Paste domains, emails, profile URLs, or upload CSV before planning.
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
          Upload CSV
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onSourceUpload(file);
              }
            }}
            type="file"
          />
        </label>
      </div>

      <textarea
        className="mt-4 min-h-24 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(event) => onSourceDraftChange(event.target.value)}
        placeholder="Paste one identifier per line, or paste CSV contents here."
        value={sourceDraft}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-90"
          onClick={onSaveManualSource}
          type="button"
        >
          Save source
        </button>
        <button
          className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          onClick={onClearSource}
          type="button"
        >
          Clear
        </button>
        {sourceContext ? (
          <div className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {sourceContext.label} · {sourceContext.records.length} rows
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepIcon({ type }: { type: WorkflowStep["type"] }) {
  switch (type) {
    case "source":
      return <Database className="h-4 w-4" />;
    case "filter":
      return <Filter className="h-4 w-4" />;
    case "enrich":
      return <Layers className="h-4 w-4" />;
    case "analyze":
      return <BarChart3 className="h-4 w-4" />;
    case "output":
      return <FileText className="h-4 w-4" />;
  }
}

function stepColorClass(type: WorkflowStep["type"]) {
  switch (type) {
    case "source":
      return "border-blue-500/25 bg-blue-500/10 text-blue-300";
    case "filter":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    case "enrich":
      return "border-violet-500/25 bg-violet-500/10 text-violet-300";
    case "analyze":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    case "output":
      return "border-pink-500/25 bg-pink-500/10 text-pink-300";
  }
}
