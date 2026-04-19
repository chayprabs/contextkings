"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  RotateCcw,
  Share2,
} from "lucide-react";
import { CompanyResearchView } from "@/components/views/CompanyResearchView";
import { CandidateListView } from "@/components/views/CandidateListView";
import { ComparisonView } from "@/components/views/ComparisonView";
import { exportRunAsCsv, exportRunAsJson } from "@/lib/persistence/repository";
import type { ExecutionResponse, WorkflowStep } from "@/lib/plan-mode";

interface ResultsScreenProps {
  steps: WorkflowStep[];
  result: ExecutionResponse;
  onBackToPlanner: () => void;
  onNewRun: () => void;
}

export function ResultsScreen({
  steps,
  result,
  onBackToPlanner,
  onNewRun,
}: ResultsScreenProps) {
  const [showPipeline, setShowPipeline] = useState(true);
  const { run, metadata, viewType } = result;

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
    const blob = new Blob(
      [exportAsCsv ? exportRunAsCsv(run) : exportRunAsJson(run)],
      {
        type: exportAsCsv
          ? "text/csv;charset=utf-8"
          : "application/json;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contextkings-${run.runId}.${exportAsCsv ? "csv" : "json"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="min-h-screen bg-background text-foreground">
      <header className="relative border-b border-border">
        <div className="flex h-12 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:bg-card hover:text-foreground"
              onClick={onBackToPlanner}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Run complete
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm tracking-[0.28em] text-foreground">
            ContextKings
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
              <span className="tabular-nums">
                {metadata.records} {metadata.entity}
              </span>
              <span className="tabular-nums">{metadata.duration}</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
              onClick={() => setShowPipeline((previous) => !previous)}
              type="button"
            >
              Pipeline
              <ChevronDown
                className={`h-4 w-4 transition ${
                  showPipeline ? "rotate-180" : ""
                }`}
              />
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
              className="inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground"
              onClick={onNewRun}
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
              New run
            </button>
          </div>
        </div>

        {showPipeline ? (
          <div className="border-t border-border bg-card/50 px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {step.label}
                  </div>
                  {index < steps.length - 1 ? (
                    <div className="h-px w-4 bg-border" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        {run.warnings.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
            {run.warnings[0]}
          </div>
        ) : null}

        {viewType === "candidate-list" ? (
          <CandidateListView run={run} />
        ) : viewType === "comparison" ? (
          <ComparisonView run={run} />
        ) : (
          <CompanyResearchView run={run} />
        )}
      </div>
    </section>
  );
}
