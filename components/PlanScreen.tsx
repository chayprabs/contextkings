"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  Paperclip,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createExecutionBlockerMessage, hasExecutablePlanSteps, type PlanMessage, type SavedRun, type WorkflowStep } from "@/lib/plan-mode";
import { sourceContextSchema, type SourceContext, type ValidatedWorkflowSpec } from "@/lib/workflow/schema";

export type { WorkflowStep } from "@/lib/plan-mode";

interface PlanScreenProps {
  isHydrating: boolean;
  messages: PlanMessage[];
  onExecutePlan: (steps: WorkflowStep[], workflow: ValidatedWorkflowSpec) => void;
  onLoadRun: (run: SavedRun) => void;
  onPlanChange: (input: {
    messages: PlanMessage[];
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec | null;
    sourceContext: SourceContext | null;
  }) => void;
  savedRuns: SavedRun[];
  sourceContext: SourceContext | null;
  workflowSteps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec | null;
  repoError?: string | null;
}

const STARTER_PROMPTS = [
  "Research B2B SaaS companies in India for outbound",
  "Scout engineering candidates from LinkedIn profiles",
  "Compare 3 competitors in vertical AI infrastructure",
  "Monitor funding rounds for climate startups",
];

const GENERATION_STAGES = [
  "Analyzing prompt...",
  "Identifying data sources...",
  "Mapping pipeline steps...",
  "Optimizing workflow...",
  "Finalizing plan...",
];

export function PlanScreen({
  isHydrating,
  messages,
  onExecutePlan,
  onLoadRun,
  onPlanChange,
  savedRuns,
  sourceContext,
  workflowSteps,
  workflow,
  repoError,
}: PlanScreenProps) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState(0);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const sourceDraftRef = useRef<HTMLTextAreaElement | null>(null);
  const hasActiveSession =
    messages.length > 0 ||
    workflowSteps.length > 0 ||
    Boolean(workflow) ||
    Boolean(sourceContext);
  const showWorkflowPane = hasActiveSession || isGenerating;
  const showRestoreState = isHydrating && !showWorkflowPane;
  const canExecute = Boolean(workflow) && hasExecutablePlanSteps(workflowSteps);
  const executionBlocker = createExecutionBlockerMessage(workflowSteps);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, workflowSteps.length, isGenerating]);

  useEffect(() => {
    if (!historyOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [historyOpen]);

  async function submitPrompt(rawPrompt: string) {
    const normalizedPrompt = rawPrompt.trim();
    if ((!normalizedPrompt && !selectedAttachment && !localSourceDraft.trim()) || isSubmitting) {
      return;
    }

    const attachment = selectedAttachment
      ? {
          name: selectedAttachment.name,
          mimeType: selectedAttachment.type || inferMimeType(selectedAttachment.name),
        }
      : null;
    const resolvedPrompt =
      normalizedPrompt ||
      (attachment
        ? `Analyze the attached file ${attachment.name}`
        : "Analyze the pasted local source and prepare a workflow.");
    const nextUserMessage: PlanMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content:
        normalizedPrompt ||
        (attachment
          ? "Attached a file for workflow planning."
          : "Pasted a local source for workflow planning."),
      attachment,
    };
    const optimisticMessages = [...messages, nextUserMessage];

    setInput("");
    setError(null);
    setIsSubmitting(true);
    setIsGenerating(true);
    setGeneratingStage(0);
    setGeneratingProgress(0);
    setHistoryOpen(false);

    const localSourceDraft = sourceDraftRef.current?.value ?? sourceContext?.content ?? "";
    const attachmentContext = selectedAttachment
      ? await fileToSourceContext(selectedAttachment)
      : null;
    const pastedSourceContext =
      !selectedAttachment && localSourceDraft.trim().length > 0
        ? manualSourceContextFromText(localSourceDraft)
        : null;
    const activeSourceContext =
      attachmentContext ?? pastedSourceContext ?? sourceContext ?? null;

    onPlanChange({
      messages: optimisticMessages,
      workflowSteps,
      workflow,
      sourceContext: activeSourceContext,
    });

    let stageIndex = 0;
    const stageTimer = window.setInterval(() => {
      stageIndex += 1;
      setGeneratingStage(Math.min(stageIndex, GENERATION_STAGES.length - 1));
      setGeneratingProgress(
        Math.min(
          Math.round(((stageIndex + 1) / GENERATION_STAGES.length) * 100),
          100,
        ),
      );
    }, 450);

    try {
      const [response] = await Promise.all([
        fetch("/api/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: resolvedPrompt,
            latestWorkflow: workflow,
            sourceContext: activeSourceContext,
          }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 2250)),
      ]);

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
        sourceContext: activeSourceContext,
      });
      setSelectedAttachment(null);
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
              "I could not build the workflow right now. Try adjusting the request or sending it again.",
          },
        ],
        workflowSteps,
        workflow,
        sourceContext,
      });
    } finally {
      window.clearInterval(stageTimer);
      setGeneratingProgress(100);
      setGeneratingStage(GENERATION_STAGES.length - 1);
      setIsGenerating(false);
      setIsSubmitting(false);
    }
  }

  function clearPlan() {
    setInput("");
    setSelectedAttachment(null);
    if (sourceDraftRef.current) {
      sourceDraftRef.current.value = "";
    }
    setError(null);
    setHistoryOpen(false);
    onPlanChange({
      messages: [],
      workflowSteps: [],
      workflow: null,
      sourceContext: null,
    });
  }

  function deleteStep(stepId: string) {
    onPlanChange({
      messages,
      workflowSteps: workflowSteps.filter((step) => step.id !== stepId),
      workflow,
      sourceContext,
    });
  }

  return (
    <section className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <div className="app-frame flex min-h-[calc(100svh-3.5rem)] w-full flex-col px-4 py-6 md:px-6 md:py-7">
        {showRestoreState ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-full max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-6xl">
                Restoring your workspace
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                Loading your last planner session and saved runs from local PGlite storage.
              </p>
              <div className="mx-auto mt-8 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-card">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-accent-blue" />
              </div>
            </div>
          </div>
        ) : !showWorkflowPane ? (
          <div className="relative flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-3xl text-center">
              <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-[4.3rem]">
                What should we research?
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Describe your goal in plain language and ContextKings will map it into a research workflow.
              </p>
              {repoError ? (
                <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  {repoError}
                </div>
              ) : null}
            </div>

            <div className="shell-panel mt-10 w-full max-w-5xl rounded-[34px] p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="thin-label text-[var(--accent)]">Optional local source</div>
                  <p className="mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    Paste domains, emails, profile URLs, or CSV contents before planning.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                  Upload CSV
                  <input
                    accept=".csv,.txt,.json,.xlsx,application/json,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(event) => {
                      setSelectedAttachment(event.target.files?.[0] ?? null);
                    }}
                    type="file"
                  />
                </label>
              </div>

              <div className="mt-5 overflow-hidden rounded-[26px] border border-border bg-black">
                <textarea
                  key={sourceContext?.label ?? sourceContext?.content ?? "empty-source"}
                  className="min-h-[180px] w-full bg-transparent px-5 py-5 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground"
                  defaultValue={sourceContext?.content ?? ""}
                  placeholder="Paste one identifier per line, or paste CSV contents here."
                  ref={sourceDraftRef}
                />
              </div>
            </div>

            <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-[24px] border border-border bg-card p-5 text-left transition duration-200 hover:border-[var(--accent)]/40 hover:bg-[#1a1a1a]"
                  onClick={() => {
                    void submitPrompt(prompt);
                  }}
                  type="button"
                >
                  <div className="text-sm font-medium leading-6">{prompt}</div>
                </button>
              ))}
            </div>

            <FloatingComposer
              historyOpen={historyOpen}
              historyRef={historyRef}
              input={input}
              onAttachmentSelect={setSelectedAttachment}
              onChange={setInput}
              onHistoryToggle={() => setHistoryOpen((previous) => !previous)}
              onRemoveAttachment={() => setSelectedAttachment(null)}
              onSubmit={() => {
                void submitPrompt(input);
              }}
              placeholder="Describe what you want to build..."
              savedRuns={savedRuns}
              selectedAttachment={selectedAttachment}
              showHistoryButton={savedRuns.length > 0}
              onLoadRun={(run) => {
                setHistoryOpen(false);
                onLoadRun(run);
              }}
            />
          </div>
        ) : (
          <div className="shell-panel flex flex-1 flex-col overflow-hidden rounded-[36px] transition-all duration-300 md:flex-row">
            <div className="relative flex w-full flex-col border-b border-border pb-24 md:w-1/2 md:border-b-0">
              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="mx-auto flex h-full max-w-2xl flex-col gap-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {repoError ? (
                    <div className="max-w-[80%] rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                      {repoError}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="max-w-[80%] rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                      {error}
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>
              </div>

              <FloatingComposer
                historyOpen={false}
                historyRef={historyRef}
                input={input}
                onAttachmentSelect={setSelectedAttachment}
                onChange={setInput}
                onHistoryToggle={() => undefined}
                onRemoveAttachment={() => setSelectedAttachment(null)}
                onSubmit={() => {
                  void submitPrompt(input);
                }}
                placeholder="Refine..."
                savedRuns={savedRuns}
                selectedAttachment={selectedAttachment}
                showHistoryButton={false}
                onLoadRun={onLoadRun}
              />
            </div>

            <aside className="w-full border-l border-border md:w-1/2">
              <div className="h-full px-5 py-5 md:px-6">
                {isGenerating ? (
                  <GenerationPanel
                    progress={generatingProgress}
                    stage={GENERATION_STAGES[generatingStage] ?? GENERATION_STAGES[0]}
                  />
                ) : (
                  <div className="flex h-full flex-col rounded-[30px] border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
                          <Sparkles className="h-4 w-4 text-accent-blue" />
                        </div>
                        <div>
                          <div className="text-base font-semibold tracking-[-0.03em]">
                            Workflow Plan
                          </div>
                          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {workflowSteps.length} steps ready
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                          onClick={clearPlan}
                          type="button"
                        >
                          Clear
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-90 disabled:opacity-40"
                          disabled={!canExecute}
                          onClick={() => {
                            if (workflow) {
                              onExecutePlan(workflowSteps, workflow);
                            }
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
                        <div className="absolute left-[27px] top-[32px] h-[calc(100%-64px)] w-px bg-border" />
                      ) : null}

                      <div className="space-y-2">
                        {workflowSteps.map((step, index) => (
                          <div
                            key={step.id}
                            className="group relative flex items-start gap-4 rounded-[22px] border border-white/6 bg-white/[0.02] px-3 py-3"
                          >
                            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${stepColorClass(step.type)}`}>
                              <StepIcon type={step.type} />
                            </div>

                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                {step.type} #{index + 1}
                              </div>
                              <div className="mt-1 text-sm font-medium">{step.label}</div>
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
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function FloatingComposer({
  historyOpen,
  historyRef,
  input,
  onAttachmentSelect,
  onChange,
  onHistoryToggle,
  onLoadRun,
  onRemoveAttachment,
  onSubmit,
  placeholder,
  savedRuns,
  selectedAttachment,
  showHistoryButton,
}: {
  historyOpen: boolean;
  historyRef: RefObject<HTMLDivElement | null>;
  input: string;
  onAttachmentSelect: (file: File | null) => void;
  onChange: (value: string) => void;
  onHistoryToggle: () => void;
  onLoadRun: (run: SavedRun) => void;
  onRemoveAttachment: () => void;
  onSubmit: () => void;
  placeholder: string;
  savedRuns: SavedRun[];
  selectedAttachment: File | null;
  showHistoryButton: boolean;
}) {
  const isDisabled = input.trim().length === 0 && !selectedAttachment;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-4 pb-5 md:px-6">
      <div className="pointer-events-auto mx-auto w-full max-w-3xl">
        {selectedAttachment ? (
          <div className="mb-3 flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              {selectedAttachment.name}
              <button
                className="text-muted-foreground transition hover:text-foreground"
                onClick={onRemoveAttachment}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        <div
          ref={historyRef}
          className="relative rounded-[28px] border border-border bg-card shadow-lg shadow-black/20"
        >
          {historyOpen ? (
            <div className="absolute bottom-[calc(100%+12px)] left-0 z-20 w-[320px] rounded-[24px] border border-border bg-[#0d0d0d] p-3 shadow-2xl shadow-black/40">
              <div className="px-2 pb-2">
                <div className="text-sm font-medium text-foreground">
                  Pick up where you left off
                </div>
              </div>
              <div className="space-y-1">
                {savedRuns.map((run) => (
                  <button
                    key={run.id}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-card"
                    onClick={() => onLoadRun(run)}
                    type="button"
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {run.title}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {formatRelativeTimestamp(run.timestamp)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative flex h-[72px] items-center gap-2 px-2">
            {showHistoryButton ? (
              <button
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-background hover:text-foreground"
                onClick={onHistoryToggle}
                type="button"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            ) : null}

            <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-background hover:text-foreground">
              <Paperclip className="h-4 w-4" />
              <input
                accept=".csv,.txt,.json,.xlsx,application/json,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  onAttachmentSelect(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </label>

            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background transition ${
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
    </div>
  );
}

function MessageBubble({ message }: { message: PlanMessage }) {
  return (
    <article
      className={`max-w-[80%] ${
        message.role === "user"
          ? "ml-auto rounded-[24px] rounded-br-md bg-foreground px-4 py-3 text-background"
          : "rounded-[24px] px-2 py-2 text-foreground"
      }`}
    >
      {message.attachment ? (
        <div
          className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            message.role === "user"
              ? "border-background/15 bg-background/10 text-background"
              : "border-border bg-card text-foreground"
          }`}
        >
          <Paperclip className="h-3 w-3" />
          {message.attachment.name}
        </div>
      ) : null}
      <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
    </article>
  );
}

function GenerationPanel({
  progress,
  stage,
}: {
  progress: number;
  stage: string;
}) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[30px] border border-border bg-card px-6">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            className="stroke-border"
            cx="50"
            cy="50"
            fill="none"
            r="42"
            strokeWidth="4"
          />
          <circle
            className="stroke-accent-blue transition-[stroke-dashoffset] duration-300"
            cx="50"
            cy="50"
            fill="none"
            r="42"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-accent-blue/10 text-accent-blue">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="text-lg font-semibold">Building workflow</div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {stage}
        </div>
      </div>

      <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-accent-blue transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
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
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "filter":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "enrich":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";
    case "analyze":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "output":
      return "border-pink-500/30 bg-pink-500/10 text-pink-300";
  }
}

function formatRelativeTimestamp(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function inferMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

function manualSourceContextFromText(content: string): SourceContext {
  const normalized = content.trim();
  const records = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((value, index) => ({
      line: String(index + 1),
      value,
    }));

  return sourceContextSchema.parse({
    kind: "manual",
    label: "Pasted source",
    content: normalized,
    records,
  });
}

async function fileToSourceContext(file: File): Promise<SourceContext | null> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    const content = await file.text();
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    return sourceContextSchema.parse({
      kind: "csv",
      label: file.name,
      content,
      records: parsed.data.slice(0, 20),
    });
  }

  if (lower.endsWith(".txt")) {
    const content = await file.text();
    const records = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value, index) => ({
        line: String(index + 1),
        value,
      }));

    return sourceContextSchema.parse({
      kind: "manual",
      label: file.name,
      content,
      records,
    });
  }

  if (lower.endsWith(".json")) {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const records = Array.isArray(parsed)
      ? parsed
          .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
          .slice(0, 20)
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, stringifyCell(value)]),
            ),
          )
      : [];

    return sourceContextSchema.parse({
      kind: "csv",
      label: file.name,
      content,
      records,
    });
  }

  if (lower.endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
    });
    const records = json.slice(0, 20).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, stringifyCell(value)]),
      ),
    );

    return sourceContextSchema.parse({
      kind: "csv",
      label: file.name,
      content: JSON.stringify(records),
      records,
    });
  }

  return null;
}

function stringifyCell(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value ?? "");
}

function manualSourceContextFromText(content: string): SourceContext | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
  });
  const csvRecords = parsed.data
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim().length > 0))
    .slice(0, 20);

  if (csvRecords.length > 0 && Object.keys(csvRecords[0] ?? {}).length > 1) {
    return sourceContextSchema.parse({
      kind: "csv",
      label: "Pasted source",
      content: trimmed,
      records: csvRecords,
    });
  }

  const records = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value, index) => ({
      line: String(index + 1),
      value,
    }));

  if (records.length === 0) {
    return null;
  }

  return sourceContextSchema.parse({
    kind: "manual",
    label: "Pasted source",
    content: trimmed,
    records,
  });
}
