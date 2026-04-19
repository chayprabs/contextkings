"use client";

import { useMemo, useState } from "react";
import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileText,
  Filter,
  Layers,
  Share2,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CompanyResearchView } from "@/components/views/CompanyResearchView";
import { CandidateListView } from "@/components/views/CandidateListView";
import { ComparisonView } from "@/components/views/ComparisonView";
import { exportRunAsCsv, exportRunAsJson } from "@/lib/persistence/repository";
import { registry } from "@/lib/ui/registry";
import { buildFallbackRunSpec } from "@/lib/ui/specs";
import type { ExecutionResponse, WorkflowStep } from "@/lib/plan-mode";

interface ResultsScreenProps {
  onBack: () => void;
  onSaveRun: (title: string) => void;
  result: ExecutionResponse;
  steps: WorkflowStep[];
}

export function ResultsScreen({
  onBack,
  onSaveRun,
  result,
  steps,
}: ResultsScreenProps) {
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { run, metadata, viewType } = result;
  const suggestedTitle = useMemo(
    () => run.derivedInsights.title || `Saved run ${new Date().toLocaleTimeString()}`,
    [run.derivedInsights.title],
  );
  const canvasSpec = useMemo(
    () => (isSpec(run.uiModel) ? run.uiModel : buildFallbackRunSpec(run)),
    [run],
  );

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

  return (
    <section className="min-h-screen bg-background text-foreground">
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
            <div className="inline-flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Run complete
            </div>
            <div className="hidden h-5 w-px bg-border md:block" />
            <div className="hidden items-center gap-4 md:flex">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                {metadata.records} {metadata.entity}
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
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
              onClick={() => setPipelineOpen(true)}
              type="button"
            >
              Pipeline
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground"
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
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
              onClick={() => setSaveDialogOpen(true)}
              type="button"
            >
              New run
            </button>
          </>
        }
      />

      <div className="app-frame w-full px-4 py-6 md:px-6 md:py-7">
        <section className="shell-panel mb-7 overflow-hidden rounded-[34px] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="thin-label text-[var(--accent)]">
                Generated app canvas
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-[2.1rem]">
                Structured workspace
              </h2>
            </div>
            <div className="rounded-full border border-border bg-background/30 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {run.status}
            </div>
          </div>

          <div className="canvas-panel overflow-hidden rounded-[30px] p-4 md:p-7">
            <div className="mx-auto w-full max-w-[92rem]">
              <JSONUIProvider handlers={{}} initialState={{}} registry={registry}>
                <Renderer loading={false} registry={registry} spec={canvasSpec} />
              </JSONUIProvider>
            </div>
          </div>
        </section>

        <div className="shell-panel rounded-[34px] p-4 md:p-6">
          {viewType === "candidate-list" ? (
            <CandidateListView run={run} />
          ) : viewType === "comparison" ? (
            <ComparisonView run={run} />
          ) : (
            <CompanyResearchView run={run} />
          )}
        </div>
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
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[400px] border-l border-border bg-[#0d0d0d] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
            <div>
              <div className="text-lg font-semibold tracking-[-0.03em]">
                Pipeline details
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {steps.length} steps
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

          <div className="relative flex-1 overflow-y-auto px-5 py-5">
            {steps.length > 1 ? (
              <div className="absolute left-[44px] top-[44px] h-[calc(100%-88px)] w-px bg-border" />
            ) : null}
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="relative flex items-start gap-4 rounded-[22px] border border-white/6 bg-white/[0.02] px-3 py-3"
                >
                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border ${stepColorClass(step.type)}`}>
                    <StepIcon type={step.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium">{step.label}</div>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    </div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </div>
                    <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {step.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span>{records} records processed</span>
              <span>{duration}</span>
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
      <div className="w-full max-w-md rounded-[30px] border border-border bg-[#0d0d0d] p-6 shadow-2xl shadow-black/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em]">
          Save this run?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          You can save this run before starting a fresh workflow from the planner.
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <div>
              <div>Records</div>
              <div className="mt-2 text-sm text-foreground">{records}</div>
            </div>
            <div>
              <div>Duration</div>
              <div className="mt-2 text-sm text-foreground">{duration}</div>
            </div>
            <div>
              <div>Steps</div>
              <div className="mt-2 text-sm text-foreground">{stepCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm transition hover:text-foreground"
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

function isSpec(value: unknown): value is Spec {
  return Boolean(
    value &&
      typeof value === "object" &&
      "root" in value &&
      "elements" in value,
  );
}
