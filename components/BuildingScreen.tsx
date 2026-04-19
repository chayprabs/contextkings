"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { createExecutionMetadata, detectViewType, type ExecutionResponse, type WorkflowStep } from "@/lib/plan-mode";
import type { SourceContext, ValidatedWorkflowSpec } from "@/lib/workflow/schema";

interface BuildingScreenProps {
  sourceContext: SourceContext | null;
  steps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec;
  onComplete: (result: ExecutionResponse) => void;
}

export function BuildingScreen({
  sourceContext,
  steps,
  workflow,
  onComplete,
}: BuildingScreenProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const completeRun = useEffectEvent(onComplete);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let resolvedResult: ExecutionResponse | null = null;
    let progressFinished = false;

    async function executeWorkflow() {
      try {
        const response = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow,
            steps,
            sourceContext,
          }),
        });

        if (!response.ok) {
          throw new Error("Unable to execute the workflow.");
        }

        resolvedResult = (await response.json()) as ExecutionResponse;
      } catch (error) {
        const durationMs = 0;
        const failedRun = {
          runId: `run-${crypto.randomUUID()}`,
          workflowId: `workflow-${crypto.randomUUID()}`,
          status: "failed" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          counts: {
            input: 0,
            enriched: 0,
            derived: 0,
            failed: 1,
          },
          warnings: [
            error instanceof Error ? error.message : "Unable to execute the workflow.",
          ],
          records: [],
          derivedInsights: {
            title: "Execution failed",
            summary:
              "The workflow could not complete. Review the warnings and go back to the planner to try another run.",
            highlights: [],
            recommendations: [
              "Go back to the planner and retry the run.",
              "Check whether the workflow still matches the data you want to execute.",
            ],
            segments: [],
          },
          uiModel: null,
        };
        const viewType = detectViewType(steps, workflow);

        resolvedResult = {
          run: failedRun,
          viewType,
          metadata: createExecutionMetadata(failedRun, viewType, durationMs),
        };
      }

      maybeComplete();
    }

    function advanceProgress(index: number) {
      if (cancelled) {
        return;
      }

      if (index >= steps.length) {
        progressFinished = true;
        maybeComplete();
        return;
      }

      const delay = 600 + Math.random() * 800;
      timer = window.setTimeout(() => {
        setCompletedSteps((previous) => {
          const next = new Set(previous);
          next.add(index);
          return next;
        });
        setActiveStep(index + 1);
        advanceProgress(index + 1);
      }, delay);
    }

    function maybeComplete() {
      if (cancelled || !progressFinished || !resolvedResult) {
        return;
      }

      window.setTimeout(() => {
        if (!cancelled && resolvedResult) {
          completeRun(resolvedResult);
        }
      }, 800);
    }

    void executeWorkflow();
    advanceProgress(0);

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sourceContext, steps, workflow]);

  const completedCount = completedSteps.size;
  const total = Math.max(steps.length, 1);
  const circumference = 2 * Math.PI * 34;
  const progress = completedCount / total;
  const offset = circumference - progress * circumference;
  const runningLabel =
    activeStep < steps.length ? steps[activeStep]?.label : "Finalizing workspace";

  return (
    <section className="min-h-screen bg-background text-foreground">
      <header className="relative flex h-12 items-center justify-center border-b border-border">
        <div className="text-sm tracking-[0.28em] text-foreground">ContextKings</div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-4xl flex-col items-center justify-center px-6 py-12">
        <div className="flex h-20 w-20 items-center justify-center">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              className="stroke-border"
              cx="40"
              cy="40"
              fill="none"
              r="34"
              strokeWidth="3"
            />
            <circle
              className="stroke-foreground transition-[stroke-dashoffset] duration-500"
              cx="40"
              cy="40"
              fill="none"
              r="34"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-lg font-semibold tabular-nums text-foreground">
              {completedCount} / {steps.length}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            Building your workspace
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Running: {runningLabel}
          </p>
        </div>

        <div className="mt-10 w-full space-y-3">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isActive = index === activeStep && activeStep < steps.length;
            const isPending = !isCompleted && !isActive;

            return (
              <div
                key={step.id}
                className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-4 ${
                  isActive ? "border border-border bg-card" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-foreground" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                  <div
                    className={`min-w-0 text-sm ${
                      isPending
                        ? "text-muted-foreground/50"
                        : isCompleted
                          ? "text-muted-foreground"
                          : "text-foreground"
                    }`}
                  >
                    {step.label}
                  </div>
                </div>

                {isCompleted ? (
                  <div className="text-sm text-emerald-400">done</div>
                ) : isActive ? (
                  <div className="text-sm text-muted-foreground">running</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
