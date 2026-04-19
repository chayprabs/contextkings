"use client";

import { useEffect, useState } from "react";
import { BuildingScreen } from "@/components/BuildingScreen";
import { PlanScreen } from "@/components/PlanScreen";
import { ResultsScreen } from "@/components/ResultsScreen";
import { buildFallbackPlan, type ExecutionResponse, type PlanMessage, type SavedRun, type WorkflowStep } from "@/lib/plan-mode";
import { getPersistenceRepository } from "@/lib/persistence/repository";
import type { SourceContext, ValidatedWorkflowSpec } from "@/lib/workflow/schema";

type Screen = "plan" | "building" | "results";

const THREAD_ID = "contextkings-plan-thread";

export function ContextKingsApp() {
  const [screen, setScreen] = useState<Screen>("plan");
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [plannedWorkflow, setPlannedWorkflow] =
    useState<ValidatedWorkflowSpec | null>(null);
  const [executedSteps, setExecutedSteps] = useState<WorkflowStep[]>([]);
  const [executedWorkflow, setExecutedWorkflow] =
    useState<ValidatedWorkflowSpec | null>(null);
  const [executedSourceContext, setExecutedSourceContext] =
    useState<SourceContext | null>(null);
  const [currentSourceContext, setCurrentSourceContext] =
    useState<SourceContext | null>(null);
  const [result, setResult] = useState<ExecutionResponse | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const repo = await getPersistenceRepository();
        const snapshot = await repo.loadPlanThread(THREAD_ID);

        if (cancelled || !snapshot) {
          return;
        }

        setMessages(snapshot.messages);
        setWorkflowSteps(snapshot.workflowSteps);
        setPlannedWorkflow(snapshot.workflow);
        setCurrentSourceContext(snapshot.sourceContext);
        setSavedRuns(snapshot.savedRuns);
      } catch (error) {
        if (!cancelled) {
          setRepoError(
            error instanceof Error
              ? error.message
              : "Unable to restore planner state.",
          );
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
  }, []);

  useEffect(() => {
    if (isHydrating || screen === "building") {
      return;
    }

    const workflowToPersist = plannedWorkflow ?? executedWorkflow ?? null;
    const sourceContextToPersist =
      currentSourceContext ?? executedSourceContext ?? null;

    void persistPlanThread({
      threadId: THREAD_ID,
      messages,
      workflowSteps: screen === "results" ? executedSteps : workflowSteps,
      workflow: workflowToPersist,
      latestRun: result?.run ?? null,
      sourceContext: sourceContextToPersist,
      savedRuns,
    }).catch((error) => {
      setRepoError(
        error instanceof Error
          ? error.message
          : "Unable to persist planner state.",
      );
    });
  }, [
    currentSourceContext,
    executedSourceContext,
    executedSteps,
    executedWorkflow,
    isHydrating,
    messages,
    plannedWorkflow,
    result,
    savedRuns,
    screen,
    workflowSteps,
  ]);

  function handlePlanChange(input: {
    messages: PlanMessage[];
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec | null;
    sourceContext: SourceContext | null;
  }) {
    setMessages(input.messages);
    setWorkflowSteps(input.workflowSteps);
    setPlannedWorkflow(input.workflow);
    setCurrentSourceContext(input.sourceContext);
  }

  function handleExecute(steps: WorkflowStep[], workflow: ValidatedWorkflowSpec) {
    setExecutedSteps(steps);
    setExecutedWorkflow(workflow);
    setExecutedSourceContext(currentSourceContext);
    setResult(null);
    setScreen("building");
  }

  function handleBuildComplete(nextResult: ExecutionResponse) {
    setResult(nextResult);
    setSavedRuns((previous) =>
      upsertSavedRun(previous, {
        id: nextResult.run.runId,
        runId: nextResult.run.runId,
        title: executedWorkflow?.goal ?? nextResult.run.derivedInsights.title,
        timestamp: Date.parse(nextResult.run.createdAt) || Date.now(),
        steps: executedSteps,
        workflow: executedWorkflow,
        sourceContext: executedSourceContext,
      }),
    );
    setScreen("results");
  }

  function handleBackToPlan() {
    setScreen("plan");
    setMessages([]);
    setWorkflowSteps([]);
    setPlannedWorkflow(null);
    setCurrentSourceContext(null);
    setExecutedSteps([]);
    setExecutedWorkflow(null);
    setExecutedSourceContext(null);
    setResult(null);
  }

  function handleSaveRun(title: string) {
    setSavedRuns((previous) =>
      upsertSavedRun(previous, {
        id: result?.run.runId ?? `saved-${crypto.randomUUID()}`,
        runId: result?.run.runId,
        title,
        timestamp: result
          ? Date.parse(result.run.createdAt) || Date.now()
          : Date.now(),
        steps: executedSteps,
        workflow: executedWorkflow,
        sourceContext: executedSourceContext,
      }),
    );
  }

  function handleLoadRun(run: SavedRun) {
    const fallback = buildFallbackPlan(run.title, run.sourceContext ?? null);
    const workflow = run.workflow ?? fallback.workflow;
    const steps = run.steps.length > 0 ? run.steps : fallback.steps;

    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Restored "${run.title}". You can refine the plan or execute it again.`,
      },
    ]);
    setWorkflowSteps(steps);
    setPlannedWorkflow(workflow);
    setCurrentSourceContext(run.sourceContext ?? null);
    setResult(null);
    setScreen("plan");
  }

  if (screen === "building" && executedWorkflow) {
    return (
      <BuildingScreen
        onComplete={handleBuildComplete}
        sourceContext={executedSourceContext}
        steps={executedSteps}
        workflow={executedWorkflow}
      />
    );
  }

  if (screen === "results" && result) {
    return (
      <ResultsScreen
        onBack={handleBackToPlan}
        onSaveRun={handleSaveRun}
        result={result}
        steps={executedSteps}
      />
    );
  }

  return (
    <PlanScreen
      isHydrating={isHydrating}
      messages={messages}
      onExecutePlan={handleExecute}
      onLoadRun={handleLoadRun}
      onPlanChange={handlePlanChange}
      repoError={repoError}
      savedRuns={savedRuns}
      sourceContext={currentSourceContext}
      workflow={plannedWorkflow}
      workflowSteps={workflowSteps}
    />
  );
}

async function persistPlanThread(input: {
  threadId: string;
  messages: PlanMessage[];
  workflowSteps: WorkflowStep[];
  workflow: ValidatedWorkflowSpec | null;
  latestRun: ExecutionResponse["run"] | null;
  sourceContext: SourceContext | null;
  savedRuns: SavedRun[];
}) {
  const repo = await getPersistenceRepository();
  await repo.savePlanThread(input);
}

function upsertSavedRun(previous: SavedRun[], candidate: SavedRun) {
  const next = previous.filter((run) => run.id !== candidate.id);
  return [candidate, ...next].sort((left, right) => right.timestamp - left.timestamp);
}
