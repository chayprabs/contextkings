"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Download,
  FileText,
  Filter,
  Layers,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { RunDashboardCanvas } from "@/components/RunDashboardCanvas";
import { exportRunAsCsv, exportRunAsJson } from "@/lib/persistence/repository";
import type { ExecutionResponse, WorkflowStep } from "@/lib/plan-mode";

interface ResultsScreenProps {
  onBack: () => void;
  onSaveRun: (title: string) => void;
  result: ExecutionResponse;
  steps: WorkflowStep[];
}

export function ResultsScreen(props: ResultsScreenProps) {
  const { onBack, onSaveRun, result, steps } = props;
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [lastRefine, setLastRefine] = useState("");
  const { run, metadata } = result;
  const suggestedTitle = run.derivedInsights.title || `Saved run ${new Date().toLocaleTimeString()}`;

  async function handleShare() {
    const text = `${run.derivedInsights.title}\n\n${run.derivedInsights.summary}`;

    if (navigator.share) {
      await navigator.share({
        title: "ContextKings run",
        text,
      });
      return;
    }

    await navigator.clipboard.writeText(text);
  }

  function handleExport() {
    const exportAsCsv = run.records.length > 0;
    const payload = exportAsCsv ? exportRunAsCsv(run) : exportRunAsJson(run);
    const blob = new Blob([payload], {
      type: exportAsCsv
        ? "text/csv;charset=utf-8"
        : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contextkings-${run.runId}.${exportAsCsv ? "csv" : "json"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleRefineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refineInput.trim()) {
      return;
    }

    setLastRefine(refineInput.trim());
    setRefineInput("");
    setIsRefining(true);
    window.setTimeout(() => {
      setIsRefining(false);
    }, 1400);
  }

  return (
    <section className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        hideTitle
        leftContent={
          <>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:bg-card hover:text-foreground"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Run complete
            </div>
            <div className="hidden h-5 w-px bg-border md:block" />
            <div className="hidden items-center gap-4 md:flex">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                {metadata.records} {metadata.entity.toLowerCase()}
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {metadata.duration}
              </div>
            </div>
          </>
        }
        rightContent={
          <>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition hover:bg-card"
              onClick={() => setPipelineOpen(true)}
              type="button"
            >
              Pipeline
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition hover:bg-card"
              onClick={() => {
                void handleShare();
              }}
              type="button"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-90"
              onClick={handleExport}
              type="button"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition hover:bg-card"
              onClick={() => setSaveDialogOpen(true)}
              type="button"
            >
              New run
            </button>
          </>
        }
      />

      {isRefining ? (
        <div className="relative h-0.5 overflow-hidden bg-border">
          <div className="absolute inset-y-0 left-0 w-1/3 animate-[refineSlide_1.2s_ease-in-out_infinite] bg-white" />
        </div>
      ) : null}

      <div className="relative flex-1 overflow-auto pb-40 md:pb-36">
        <div className="app-frame px-6 py-6 md:px-8">
          <RunDashboardCanvas run={run} />
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-6 pb-5">
        <form
          className="pointer-events-auto w-full max-w-2xl"
          onSubmit={handleRefineSubmit}
        >
          {lastRefine && !isRefining ? (
            <div className="mb-2 flex items-center gap-2 px-1">
              <Sparkles className="h-3 w-3 text-white/70" />
              <span className="text-[11px] text-muted-foreground">
                Applied: {lastRefine}
              </span>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center gap-3 px-4 py-3">
              <Sparkles className={`h-4 w-4 ${isRefining ? "animate-pulse text-white/70" : "text-white/30"}`} />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                disabled={isRefining}
                onChange={(event) => setRefineInput(event.target.value)}
                placeholder={
                  isRefining
                    ? "Updating results..."
                    : 'Refine results - e.g. "only Series B companies"'
                }
                value={refineInput}
              />
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 disabled:opacity-20"
                disabled={!refineInput.trim() || isRefining}
                type="submit"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>

      <PipelinePanel
        duration={metadata.duration}
        onClose={() => setPipelineOpen(false)}
        open={pipelineOpen}
        records={metadata.records}
        steps={steps}
      />

      <SaveRunDialog
        duration={metadata.duration}
        onDiscard={onBack}
        onSave={() => {
          onSaveRun(suggestedTitle);
          onBack();
        }}
        open={saveDialogOpen}
        records={metadata.records}
        stepCount={steps.length}
      />

      <style jsx global>{`
        @keyframes refineSlide {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(420%);
          }
        }
      `}</style>
    </section>
  );
}

function PipelinePanel({
  duration,
  onClose,
  open,
  records,
  steps,
}: {
  duration: string;
  onClose: () => void;
  open: boolean;
  records: number;
  steps: WorkflowStep[];
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[400px] border-l border-border bg-[#090909] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
            <div>
              <div className="text-[2rem] font-semibold tracking-[-0.04em] text-foreground">
                Pipeline details
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {steps.length} steps - all completed
              </div>
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id}>
                  <div className="flex items-start gap-4 rounded-[20px] border border-border bg-card/70 px-4 py-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${stepColorClass(step.type)}`}
                    >
                      <StepIcon type={step.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-medium tracking-[-0.03em] text-foreground">
                          {step.label}
                        </div>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      </div>
                      <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </div>
                      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {step.type}
                      </div>
                    </div>
                  </div>

                  {index < steps.length - 1 ? (
                    <div className="flex justify-center py-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="h-1.5 w-px bg-border" />
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <div className="h-1.5 w-px bg-border" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span>{records} records processed</span>
              <span>{duration} total</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SaveRunDialog({
  duration,
  onDiscard,
  onSave,
  open,
  records,
  stepCount,
}: {
  duration: string;
  onDiscard: () => void;
  onSave: () => void;
  open: boolean;
  records: number;
  stepCount: number;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[26px] border border-border bg-[#090909] p-6 shadow-2xl shadow-black/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-foreground">
          Save this run?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          You can save this run before starting a fresh workflow from the planner.
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div>
              <div>Records</div>
              <div className="mt-2 text-xl font-medium text-foreground">{records}</div>
            </div>
            <div>
              <div>Duration</div>
              <div className="mt-2 text-xl font-medium text-foreground">{duration}</div>
            </div>
            <div>
              <div>Steps</div>
              <div className="mt-2 text-xl font-medium text-foreground">{stepCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground transition hover:text-foreground"
            onClick={onDiscard}
            type="button"
          >
            Discard
          </button>
          <button
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm text-background transition hover:opacity-90"
            onClick={onSave}
            type="button"
          >
            <Bookmark className="h-4 w-4" />
            Save &amp; start new
          </button>
        </div>
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
