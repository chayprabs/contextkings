"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { buildSpecFromParts, JSONUIProvider, Renderer, useJsonRenderMessage } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { Database, Download, FileSpreadsheet, FolderClock, Sparkles, Upload, WandSparkles } from "lucide-react";
import Papa from "papaparse";
import { exportRunAsCsv, exportRunAsJson, getPersistenceRepository, type PersistedThreadSnapshot } from "@/lib/persistence/repository";
import { registry } from "@/lib/ui/registry";
import { buildFallbackRunSpec } from "@/lib/ui/specs";
import { listPromptChips, LIVE_DEMO_WORKFLOW_PROMPT } from "@/lib/workflow/planner";
import { createThreadStateSnapshot, sourceContextSchema, type RunResult, type SavedRunSummary, type SourceContext, type ThreadState, type WorkflowSpec } from "@/lib/workflow/schema";

const DEFAULT_THREAD_ID = "thread-contextkings";
const DEFAULT_PROMPTS = listPromptChips();

export function ContextKingsApp() {
  const [threadId] = useState(DEFAULT_THREAD_ID);
  const [composerValue, setComposerValue] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [activeSource, setActiveSource] = useState<SourceContext | null>(null);
  const [hydratedWorkflow, setHydratedWorkflow] = useState<WorkflowSpec | null>(null);
  const [hydratedRuns, setHydratedRuns] = useState<SavedRunSummary[]>([]);
  const [hydratedLatestRun, setHydratedLatestRun] = useState<RunResult | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [repoError, setRepoError] = useState<string | null>(null);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: threadId,
    messages: [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const repo = await getPersistenceRepository();
        const snapshot = await repo.loadThread(threadId);
        if (cancelled || !snapshot) {
          return;
        }

        setMessages(snapshot.messages);
        setHydratedWorkflow(snapshot.workflow);
        setHydratedRuns(snapshot.runs);
        setHydratedLatestRun(snapshot.latestRun);
        setActiveSource(snapshot.sourceContext);
        setDraftSource(snapshot.sourceContext?.content ?? "");
      } catch (repoLoadError) {
        if (!cancelled) {
          setRepoError(getErrorText(repoLoadError));
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [setMessages, threadId]);

  const artifactSummary = useMemo(() => extractArtifacts(messages), [messages]);
  const resolvedWorkflow = artifactSummary.workflow ?? hydratedWorkflow;
  const resolvedRuns = artifactSummary.savedRuns.length > 0 ? artifactSummary.savedRuns : hydratedRuns;
  const resolvedLatestRun = artifactSummary.latestRun ?? hydratedLatestRun;

  useEffect(() => {
    if (isHydrating || status !== "ready") {
      return;
    }

    void persistSnapshot({
      threadId,
      messages,
      workflow: resolvedWorkflow,
      runs: resolvedRuns,
      latestRun: resolvedLatestRun,
      sourceContext: activeSource,
    }).catch((persistError) => {
      setRepoError(getErrorText(persistError));
    });
  }, [activeSource, isHydrating, messages, resolvedLatestRun, resolvedRuns, resolvedWorkflow, status, threadId]);

  const threadState = useMemo<ThreadState>(
    () =>
      createThreadStateSnapshot({
        latestWorkflow: resolvedWorkflow,
        latestRun: resolvedLatestRun,
        savedRuns: resolvedRuns,
        sourceContext: activeSource,
      }),
    [activeSource, resolvedLatestRun, resolvedRuns, resolvedWorkflow],
  );

  const canvasSpec = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = buildSpecFromParts(messages[index].parts);
      if (candidate) {
        return candidate;
      }
    }

    return isSpec(resolvedLatestRun?.uiModel)
      ? resolvedLatestRun.uiModel
      : buildFallbackRunSpec(resolvedLatestRun);
  }, [messages, resolvedLatestRun]);

  async function handleSend(prompt: string) {
    if (!prompt.trim()) {
      return;
    }

    setComposerValue("");
    await sendMessage(
      { text: prompt },
      {
        body: {
          threadId,
          threadState,
          sourceContext: activeSource,
        },
      },
    );
  }

  async function handleSourceUpload(file: File) {
    const content = await file.text();
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    const source = sourceContextSchema.parse({
      kind: "csv",
      label: file.name,
      content,
      records: parsed.data.slice(0, 20),
    });

    setActiveSource(source);
    setDraftSource(content);
  }

  function saveManualSource() {
    const rows = draftSource
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ line: `${index + 1}`, value: line }));

    if (rows.length === 0) {
      setActiveSource(null);
      return;
    }

    setActiveSource(
      sourceContextSchema.parse({
        kind: "manual",
        label: "Manual source",
        content: draftSource,
        records: rows,
      }),
    );
  }

  async function downloadRun(runId: string, format: "csv" | "json") {
    try {
      const repo = await getPersistenceRepository();
      const run = await repo.getRun(runId);

      if (!run) {
        return;
      }

      const payload =
        format === "csv" ? exportRunAsCsv(run) : exportRunAsJson(run);
      const blob = new Blob([payload], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `contextkings-${runId}.${format === "csv" ? "csv" : "json"}`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (downloadError) {
      setRepoError(getErrorText(downloadError));
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
        <header className="glass-panel overflow-hidden rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                CrustData hackathon playground
              </div>
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] md:text-5xl">
                  Describe the data product you want, then let the stack compile it.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
                  ContextKings turns vague product intent into a constrained CrustData workflow, runs enrichment, stores local runs in-browser with PGlite, and renders the output as a usable app canvas.
                </p>
              </div>
            </div>
            <div className="grid gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-4 md:min-w-[340px]">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Default workflow shape
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stage label="Source" />
                <Stage label="CrustData" />
                <Stage label="LLM" />
                <Stage label="UI" />
              </div>
            </div>
          </div>
        </header>

        <section className="shell-grid items-start">
          <aside className="glass-panel rounded-[26px] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Chat control plane
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                  Build with prompts
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                {status}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {DEFAULT_PROMPTS.map((chip) => (
                <button
                  key={chip}
                  className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-2 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  onClick={() => {
                    startTransition(() => {
                      void handleSend(chip);
                    });
                  }}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(255,244,220,0.94),rgba(255,255,255,0.96))] p-4 shadow-[0_12px_30px_rgba(31,24,16,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(194,111,26,0.18)] bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Live internet demo
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-[-0.02em]">
                      Run a real CrustData workflow
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      This uses public company domains from the internet and runs the full company enrichment flow in the app. The starter dataset is OpenAI, Stripe, HubSpot, and Rippling.
                    </p>
                  </div>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={status !== "ready" || isPending}
                  onClick={() => {
                    startTransition(() => {
                      void handleSend(LIVE_DEMO_WORKFLOW_PROMPT);
                    });
                  }}
                  type="button"
                >
                  <WandSparkles className="h-4 w-4" />
                  Run live demo
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[22px] border border-[var(--line)] bg-white/70 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4 text-[var(--accent)]" />
                Optional local source
              </div>
              <textarea
                className="min-h-32 w-full rounded-[18px] border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm outline-none transition focus:border-[var(--accent)]"
                onChange={(event) => setDraftSource(event.target.value)}
                placeholder="Paste domains, LinkedIn URLs, emails, or CSV content. This stays local and is passed as context for the next workflow run."
                value={draftSource}
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white">
                  <FileSpreadsheet className="h-4 w-4" />
                  Upload CSV
                  <input
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleSourceUpload(file);
                      }
                    }}
                    type="file"
                  />
                </label>
                <button
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
                  onClick={saveManualSource}
                  type="button"
                >
                  Save local source
                </button>
                <button
                  className="rounded-full border border-transparent px-4 py-2 text-sm text-[var(--muted)]"
                  onClick={() => {
                    setDraftSource("");
                    setActiveSource(null);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
              {activeSource ? (
                <div className="rounded-[18px] border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm">
                  <div className="font-medium">
                    Active source: {activeSource.label}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">
                    {activeSource.records.length} preview rows will be available to the next prompt.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 max-h-[54vh] space-y-3 overflow-y-auto pr-1">
              {isHydrating ? (
                <div className="rounded-[22px] border border-[var(--line)] bg-white/65 p-4 text-sm text-[var(--muted)]">
                  Restoring local thread from PGlite...
                </div>
              ) : messages.length === 0 ? (
                <EmptyChatState />
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(() => {
                  void handleSend(composerValue);
                });
              }}
            >
              <textarea
                className="min-h-28 w-full rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-4 text-sm outline-none transition focus:border-[var(--accent)]"
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder="Describe the source, the enrichment you want, and what the final app should do."
                value={composerValue}
              />
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={status !== "ready" || isPending}
                type="submit"
              >
                <WandSparkles className="h-4 w-4" />
                Compile workflow
              </button>
            </form>
          </aside>

          <section className="glass-panel rounded-[26px] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Generated app canvas
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                  Runnable output
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                {resolvedLatestRun?.status ?? "idle"}
              </div>
            </div>

            <div className="mt-4 min-h-[70vh] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(251,246,238,0.92))] p-4 md:p-6">
              <JSONUIProvider handlers={{}} initialState={{}} registry={registry}>
                <Renderer loading={status !== "ready"} registry={registry} spec={canvasSpec} />
              </JSONUIProvider>
            </div>
          </section>

          <aside className="glass-panel rounded-[26px] p-4 md:p-5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Local result store
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                  PGlite runs
                </h2>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-[22px] border border-[var(--line)] bg-white/65 p-4">
              <div className="text-sm font-medium">Latest workflow summary</div>
              {resolvedWorkflow ? (
                <div className="space-y-2 text-sm text-[var(--muted)]">
                  <div>
                    <span className="font-medium text-[var(--foreground)]">Goal:</span>{" "}
                    {resolvedWorkflow.goal}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--foreground)]">Input:</span>{" "}
                    {resolvedWorkflow.inputMode}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--foreground)]">Entity:</span>{" "}
                    {resolvedWorkflow.entityType}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resolvedWorkflow.sourceHints.map((hint) => (
                      <span
                        key={hint}
                        className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--foreground)]"
                      >
                        {hint}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  The next successful workflow draft will be persisted here.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-white/65 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderClock className="h-4 w-4 text-[var(--accent)]" />
                Saved runs
              </div>
              <div className="mt-3 space-y-3">
                {resolvedRuns.length === 0 ? (
                  <div className="text-sm text-[var(--muted)]">
                    Runs will appear here after the first successful execution.
                  </div>
                ) : (
                  resolvedRuns.map((run) => (
                    <div
                      key={run.runId}
                      className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-strong)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{run.title}</div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            {run.status}
                          </div>
                        </div>
                        <div className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-xs">
                          {run.recordCount} rows
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-[var(--muted)]">
                        {run.summary}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                          onClick={() => void downloadRun(run.runId, "csv")}
                          type="button"
                        >
                          <Download className="h-3.5 w-3.5" />
                          CSV
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                          onClick={() => void downloadRun(run.runId, "json")}
                          type="button"
                        >
                          <Download className="h-3.5 w-3.5" />
                          JSON
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {(error || repoError) ? (
              <div className="mt-4 rounded-[22px] border border-[rgba(180,35,24,0.18)] bg-[rgba(180,35,24,0.08)] p-4 text-sm text-[var(--danger)]">
                {error?.message ?? repoError}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Stage({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-[var(--line)] bg-white/85 px-3 py-2 text-center font-medium">
      {label}
    </div>
  );
}

function EmptyChatState() {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white/60 p-5 text-sm text-[var(--muted)]">
      Start with something like “build a recruiting scout using LinkedIn profile URLs and score candidates for ML roles” or “make a prospecting dashboard for fintech companies in India.”
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const { text } = useJsonRenderMessage(message.parts);
  const toolStates = message.parts
    .filter(isToolUIPart)
    .map((part) => ({
      name: getToolName(part),
      state: part.state,
    }));

  return (
    <article
      className={`rounded-[24px] border p-4 ${
        message.role === "user"
          ? "border-transparent bg-[var(--foreground)] text-white"
          : "border-[var(--line)] bg-white/78 text-[var(--foreground)]"
      }`}
    >
      <div className="mb-2 text-[10px] uppercase tracking-[0.22em] opacity-70">
        {message.role === "user" ? "You" : "ContextKings"}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6">
        {text || "Working through tools..."}
      </div>
      {toolStates.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {toolStates.map((tool) => (
            <span
              key={`${tool.name}-${tool.state}`}
              className="rounded-full bg-black/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]"
            >
              {tool.name} · {tool.state}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function extractArtifacts(messages: UIMessage[]) {
  const runs = new Map<string, RunResult>();
  let workflow: WorkflowSpec | null = null;

  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") {
        continue;
      }

      const toolName = getToolName(part);
      if (toolName === "draftWorkflow" || toolName === "validateWorkflow") {
        const candidate = part.output as { workflow?: WorkflowSpec; spec?: WorkflowSpec };
        workflow = candidate.workflow ?? candidate.spec ?? workflow;
      }

      if (toolName === "runWorkflow") {
        const run = part.output as RunResult;
        runs.set(run.runId, run);
      }
    }
  }

  const latestRunValue = Array.from(runs.values()).at(-1) ?? null;
  const savedRunValues = Array.from(runs.values()).map((run) => ({
    runId: run.runId,
    workflowId: run.workflowId,
    status: run.status,
    title: run.derivedInsights.title,
    summary: run.derivedInsights.summary,
    createdAt: run.createdAt,
    recordCount: run.counts.enriched,
  }));

  return {
    workflow,
    latestRun: latestRunValue,
    savedRuns: savedRunValues,
  };
}

async function persistSnapshot(snapshot: PersistedThreadSnapshot) {
  const repo = await getPersistenceRepository();
  await repo.saveThread(snapshot);
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isSpec(value: unknown): value is Spec {
  return Boolean(
    value &&
      typeof value === "object" &&
      "root" in value &&
      "elements" in value,
  );
}
