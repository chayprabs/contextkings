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
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  createExecutionBlockerMessage,
  hasExecutablePlanSteps,
  type PlanMessage,
  type SavedRun,
  type WorkflowStep,
} from "@/lib/plan-mode";
import {
  sourceContextSchema,
  type SourceContext,
  type ValidatedWorkflowSpec,
} from "@/lib/workflow/schema";

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

const STARTER_PROMPTS: Array<{
  description: string;
  icon: LucideIcon;
  label: string;
  prompt: string;
}> = [
  {
    label: "Research B2B SaaS companies",
    description: "Series A-B, enterprise software",
    prompt: "Research B2B SaaS companies",
    icon: Database,
  },
  {
    label: "Scout engineering candidates",
    description: "Senior+, distributed systems",
    prompt: "Scout engineering candidates",
    icon: Users,
  },
  {
    label: "Compare 3 competitors",
    description: "Side-by-side market analysis",
    prompt: "Compare 3 competitors",
    icon: BarChart3,
  },
  {
    label: "Monitor funding rounds",
    description: "Track recent raises in fintech",
    prompt: "Monitor funding rounds",
    icon: Layers,
  },
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
  const [localSourceDraft, setLocalSourceDraft] = useState(
    sourceContext?.content ?? "",
  );
  const [hasSourceDraftOverride, setHasSourceDraftOverride] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const sourcePanelRef = useRef<HTMLDivElement | null>(null);

  const hasActiveSession =
    messages.length > 0 ||
    workflowSteps.length > 0 ||
    Boolean(workflow) ||
    Boolean(sourceContext);
  const showWorkflowPane = hasActiveSession || isGenerating;
  const showRestoreState = isHydrating && !showWorkflowPane;
  const canExecute = Boolean(workflow) && hasExecutablePlanSteps(workflowSteps);
  const executionBlocker = createExecutionBlockerMessage(workflowSteps);
  const sourceDraftValue = hasSourceDraftOverride
    ? localSourceDraft
    : (sourceContext?.content ?? "");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, workflowSteps.length, isGenerating]);

  useEffect(() => {
    if (!historyOpen && !sourcePanelOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (historyOpen && !historyRef.current?.contains(target)) {
        setHistoryOpen(false);
      }

      if (sourcePanelOpen && !sourcePanelRef.current?.contains(target)) {
        setSourcePanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [historyOpen, sourcePanelOpen]);

  async function submitPrompt(rawPrompt: string) {
    const normalizedPrompt = rawPrompt.trim();
    const normalizedSourceDraft = sourceDraftValue.trim();

    if ((!normalizedPrompt && !selectedAttachment && !normalizedSourceDraft) || isSubmitting) {
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
    setSourcePanelOpen(false);

    const attachmentContext = selectedAttachment
      ? await fileToSourceContext(selectedAttachment)
      : null;
    const pastedSourceContext =
      !selectedAttachment && normalizedSourceDraft
        ? manualSourceContextFromText(normalizedSourceDraft)
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
            latestSteps: workflowSteps,
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
        sourceContext: activeSourceContext,
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
    setLocalSourceDraft("");
    setHasSourceDraftOverride(false);
    setError(null);
    setHistoryOpen(false);
    setSourcePanelOpen(false);
    onPlanChange({
      messages: [],
      workflowSteps: [],
      workflow: null,
      sourceContext: null,
    });
  }

  function clearLocalSource() {
    setLocalSourceDraft("");
    setHasSourceDraftOverride(false);
    setSourcePanelOpen(false);
    if (!sourceContext) {
      return;
    }

    onPlanChange({
      messages,
      workflowSteps,
      workflow,
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

      {showRestoreState ? (
        <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-6xl">
              Restoring your workspace
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Loading your last planner session and saved runs from local PGlite storage.
            </p>
            <div className="mx-auto mt-8 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-card">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-white" />
            </div>
          </div>
        </div>
      ) : !showWorkflowPane ? (
        <div className="relative flex min-h-[calc(100svh-3.5rem)] flex-col px-4 pb-28 pt-8 md:px-6 md:pt-12">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center">
            <div className="max-w-3xl text-center">
              <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-[4.25rem] md:leading-none">
                What should we research?
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Describe your goal in plain language. We&apos;ll design a data pipeline
                you can review and tweak before running.
              </p>
              {repoError ? (
                <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  {repoError}
                </div>
              ) : null}
            </div>

            <div className="mt-10 grid w-full max-w-xl gap-3 md:max-w-2xl md:grid-cols-2">
              {STARTER_PROMPTS.map((starter) => {
                const Icon = starter.icon;
                return (
                  <button
                    key={starter.label}
                    className="rounded-[22px] border border-border bg-card px-5 py-5 text-left transition hover:border-white/30 hover:bg-[#101010]"
                    onClick={() => {
                      void submitPrompt(starter.prompt);
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{starter.label}</span>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {starter.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <PlannerComposer
            historyOpen={historyOpen}
            historyRef={historyRef}
            input={input}
            localSourceDraft={sourceDraftValue}
            onAttachmentSelect={setSelectedAttachment}
            onChange={setInput}
            onClearSource={clearLocalSource}
            onHistoryToggle={() => {
              setSourcePanelOpen(false);
              setHistoryOpen((previous) => !previous);
            }}
            onLoadRun={(run) => {
              setHistoryOpen(false);
              setHasSourceDraftOverride(false);
              setLocalSourceDraft("");
              onLoadRun(run);
            }}
            onLocalSourceChange={(value) => {
              setHasSourceDraftOverride(true);
              setLocalSourceDraft(value);
            }}
            onLocalSourceToggle={() => {
              setHistoryOpen(false);
              setSourcePanelOpen((previous) => !previous);
            }}
            onRemoveAttachment={() => setSelectedAttachment(null)}
            onSubmit={() => {
              void submitPrompt(input);
            }}
            placeholder="Describe what you want to build..."
            savedRuns={savedRuns}
            selectedAttachment={selectedAttachment}
            showHistoryButton={savedRuns.length > 0}
            showSourceButton
            sourceContextLabel={sourceContext?.label}
            sourcePanelOpen={sourcePanelOpen}
            sourcePanelRef={sourcePanelRef}
          />
        </div>
      ) : (
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-col md:flex-row">
          <div className="relative flex min-h-[50svh] flex-1 flex-col border-b border-border md:min-h-0 md:border-b-0 md:border-r">
            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6 md:px-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
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

            <PlannerComposer
              historyOpen={false}
              historyRef={historyRef}
              input={input}
              localSourceDraft={sourceDraftValue}
              onAttachmentSelect={setSelectedAttachment}
              onChange={setInput}
              onClearSource={clearLocalSource}
              onHistoryToggle={() => undefined}
              onLoadRun={onLoadRun}
              onLocalSourceChange={(value) => {
                setHasSourceDraftOverride(true);
                setLocalSourceDraft(value);
              }}
              onLocalSourceToggle={() => {
                setSourcePanelOpen((previous) => !previous);
              }}
              onRemoveAttachment={() => setSelectedAttachment(null)}
              onSubmit={() => {
                void submitPrompt(input);
              }}
              placeholder="Refine your workflow..."
              savedRuns={savedRuns}
              selectedAttachment={selectedAttachment}
              showHistoryButton={false}
              showSourceButton
              sourceContextLabel={sourceContext?.label}
              sourcePanelOpen={sourcePanelOpen}
              sourcePanelRef={sourcePanelRef}
            />
          </div>

          <aside className="flex min-h-[50svh] flex-1 flex-col md:min-h-0">
            {isGenerating ? (
              <GenerationPanel
                progress={generatingProgress}
                stage={GENERATION_STAGES[generatingStage] ?? GENERATION_STAGES[0]}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/6">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                        Workflow Plan
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
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
                      className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm text-background transition hover:opacity-90 disabled:opacity-30"
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
                    <div className="absolute left-[44px] top-[46px] h-[calc(100%-92px)] w-px bg-border" />
                  ) : null}

                  <div className="space-y-2">
                    {workflowSteps.map((step) => (
                      <div key={step.id}>
                        <div className="group relative flex items-start gap-4 rounded-[22px] border border-border bg-card/60 px-4 py-4 transition hover:bg-card">
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${stepColorClass(step.type)}`}
                          >
                            <StepIcon type={step.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${stepDotClass(step.type)}`} />
                              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                {step.type}
                              </span>
                            </div>
                            <div className="text-xl font-medium tracking-[-0.03em] text-foreground">
                              {step.label}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-muted-foreground">
                              {step.description}
                            </div>
                          </div>
                          <button
                            aria-label={`Delete ${step.label}`}
                            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-white/6 hover:text-foreground group-hover:opacity-100"
                            onClick={() => deleteStep(step.id)}
                            type="button"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function PlannerComposer({
  historyOpen,
  historyRef,
  input,
  localSourceDraft,
  onAttachmentSelect,
  onChange,
  onClearSource,
  onHistoryToggle,
  onLoadRun,
  onLocalSourceChange,
  onLocalSourceToggle,
  onRemoveAttachment,
  onSubmit,
  placeholder,
  savedRuns,
  selectedAttachment,
  showHistoryButton,
  showSourceButton,
  sourceContextLabel,
  sourcePanelOpen,
  sourcePanelRef,
}: {
  historyOpen: boolean;
  historyRef: RefObject<HTMLDivElement | null>;
  input: string;
  localSourceDraft: string;
  onAttachmentSelect: (file: File | null) => void;
  onChange: (value: string) => void;
  onClearSource: () => void;
  onHistoryToggle: () => void;
  onLoadRun: (run: SavedRun) => void;
  onLocalSourceChange: (value: string) => void;
  onLocalSourceToggle: () => void;
  onRemoveAttachment: () => void;
  onSubmit: () => void;
  placeholder: string;
  savedRuns: SavedRun[];
  selectedAttachment: File | null;
  showHistoryButton: boolean;
  showSourceButton: boolean;
  sourceContextLabel?: string | null;
  sourcePanelOpen: boolean;
  sourcePanelRef: RefObject<HTMLDivElement | null>;
}) {
  const isDisabled =
    input.trim().length === 0 &&
    !selectedAttachment &&
    localSourceDraft.trim().length === 0;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-5 md:px-6">
      <div className="pointer-events-auto w-full max-w-3xl">
        {(selectedAttachment || localSourceDraft.trim().length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {localSourceDraft.trim().length > 0 ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:bg-[#111111]"
                onClick={onLocalSourceToggle}
                type="button"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {sourceContextLabel ?? "Local source ready"}
              </button>
            ) : null}
            {selectedAttachment ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground">
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
            ) : null}
          </div>
        )}

        <div className="relative rounded-[24px] border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
          <div className="relative flex h-[72px] items-center gap-1 px-2">
            {showHistoryButton ? (
              <div className="relative" ref={historyRef}>
                {historyOpen ? (
                  <div className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-[320px] rounded-[22px] border border-border bg-[#090909] p-3 shadow-2xl shadow-black/40">
                    <div className="px-2 pb-2">
                      <div className="text-sm font-medium text-foreground">
                        Pick up where you left off
                      </div>
                    </div>
                    <div className="space-y-1">
                      {savedRuns.map((run) => (
                        <button
                          key={run.id}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#111111]"
                          onClick={() => onLoadRun(run)}
                          type="button"
                        >
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background">
                            <Database className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
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
                <button
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-[#111111] hover:text-foreground"
                  onClick={onHistoryToggle}
                  type="button"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {showSourceButton ? (
              <div className="relative" ref={sourcePanelRef}>
                {sourcePanelOpen ? (
                  <div className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-[min(38rem,calc(100vw-2.5rem))] rounded-[24px] border border-border bg-[#090909] p-4 shadow-2xl shadow-black/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Optional local source
                        </div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">
                          Paste domains, emails, profile URLs, or CSV rows to bootstrap
                          planning.
                        </div>
                      </div>
                      <button
                        className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-[#111111] hover:text-foreground"
                        onClick={onClearSource}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                    <textarea
                      className="mt-4 min-h-[160px] w-full rounded-[18px] border border-border bg-black px-4 py-4 text-sm leading-6 text-foreground outline-none"
                      onChange={(event) => onLocalSourceChange(event.target.value)}
                      placeholder="Paste one identifier per line, or paste CSV contents here."
                      value={localSourceDraft}
                    />
                  </div>
                ) : null}
                <button
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                    localSourceDraft.trim().length > 0
                      ? "bg-white/6 text-foreground"
                      : "text-muted-foreground hover:bg-[#111111] hover:text-foreground"
                  }`}
                  onClick={onLocalSourceToggle}
                  type="button"
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-[#111111] hover:text-foreground">
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
              className="min-w-0 flex-1 bg-transparent pr-12 text-sm text-foreground outline-none"
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
              className={`absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl bg-foreground text-background transition ${
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
  if (message.role === "assistant") {
    return (
      <article className="max-w-2xl text-lg leading-10 text-foreground">
        {message.content}
      </article>
    );
  }

  return (
    <article className="ml-auto max-w-[80%] rounded-[22px] bg-foreground px-5 py-4 text-background shadow-[0_12px_30px_rgba(255,255,255,0.06)]">
      {message.attachment ? (
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/10 px-3 py-1 text-xs text-background/90">
          <Paperclip className="h-3 w-3" />
          {message.attachment.name}
        </div>
      ) : null}
      <div className="text-base leading-7">{message.content}</div>
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
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            className="stroke-border"
            cx="50"
            cy="50"
            fill="none"
            r="42"
            strokeWidth="4"
          />
          <circle
            className="stroke-white transition-[stroke-dashoffset] duration-300"
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
          <Sparkles className="h-6 w-6 animate-pulse text-white" />
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="text-lg font-semibold text-foreground">Building workflow</div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {stage}
        </div>
      </div>

      <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-white transition-all duration-300"
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
      return "border-blue-500/25 bg-blue-500/12 text-blue-300";
    case "filter":
      return "border-amber-500/25 bg-amber-500/12 text-amber-300";
    case "enrich":
      return "border-violet-500/25 bg-violet-500/12 text-violet-300";
    case "analyze":
      return "border-emerald-500/25 bg-emerald-500/12 text-emerald-300";
    case "output":
      return "border-pink-500/25 bg-pink-500/12 text-pink-300";
  }
}

function stepDotClass(type: WorkflowStep["type"]) {
  switch (type) {
    case "source":
      return "bg-blue-400";
    case "filter":
      return "bg-amber-400";
    case "enrich":
      return "bg-violet-400";
    case "analyze":
      return "bg-emerald-400";
    case "output":
      return "bg-pink-400";
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
          .filter(
            (row): row is Record<string, unknown> =>
              Boolean(row && typeof row === "object"),
          )
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
    .filter((row) =>
      Object.values(row).some((value) => String(value ?? "").trim().length > 0),
    )
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
