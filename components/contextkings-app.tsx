"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BuildingScreen } from "@/components/BuildingScreen";
import { PlanScreen } from "@/components/PlanScreen";
import { ResultsScreen } from "@/components/ResultsScreen";
import { createExecutionMetadata, detectViewType, type ExecutionResponse, type PlanMessage, type WorkflowStep } from "@/lib/plan-mode";
import { getPersistenceRepository } from "@/lib/persistence/repository";
import { sourceContextSchema, type SourceContext, type ValidatedWorkflowSpec } from "@/lib/workflow/schema";

type Screen = "plan" | "building" | "results";
const DEFAULT_THREAD_ID = "thread-contextkings-plan-mode";

export function ContextKingsApp() {
  const [threadId] = useState(DEFAULT_THREAD_ID);
  const [screen, setScreen] = useState<Screen>("plan");
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [plannedWorkflow, setPlannedWorkflow] =
    useState<ValidatedWorkflowSpec | null>(null);
  const [executedSteps, setExecutedSteps] = useState<WorkflowStep[]>([]);
  const [executedWorkflow, setExecutedWorkflow] =
    useState<ValidatedWorkflowSpec | null>(null);
  const [result, setResult] = useState<ExecutionResponse | null>(null);
  const [planResetKey, setPlanResetKey] = useState(0);
  const [sourceDraft, setSourceDraft] = useState("");
  const [sourceContext, setSourceContext] = useState<SourceContext | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");

    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const repo = await getPersistenceRepository();
        const snapshot = await repo.loadPlanThread(threadId);

        if (cancelled || !snapshot) {
          return;
        }

        setMessages(snapshot.messages);
        setWorkflowSteps(snapshot.workflowSteps);
        setPlannedWorkflow(snapshot.workflow as ValidatedWorkflowSpec | null);
        setResult(
          snapshot.latestRun
            ? {
                run: snapshot.latestRun,
                viewType: detectViewType(
                  snapshot.workflowSteps,
                  snapshot.workflow,
                ),
                metadata: createExecutionMetadata(
                  snapshot.latestRun,
                  detectViewType(snapshot.workflowSteps, snapshot.workflow),
                  0,
                ),
              }
            : null,
        );
        setSourceContext(snapshot.sourceContext);
        setSourceDraft(snapshot.sourceContext?.content ?? "");
      } catch (error) {
        if (!cancelled) {
          setRepoError(error instanceof Error ? error.message : "Unable to restore local planner state.");
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
  }, [threadId]);

  useEffect(() => {
    if (isHydrating) {
      return;
    }

    void (async () => {
      try {
        const repo = await getPersistenceRepository();
        await repo.savePlanThread({
          threadId,
          messages,
          workflowSteps,
          workflow: plannedWorkflow,
          latestRun: result?.run ?? null,
          sourceContext,
        });
      } catch (error) {
        setRepoError(error instanceof Error ? error.message : "Unable to save local planner state.");
      }
    })();
  }, [isHydrating, messages, plannedWorkflow, result, sourceContext, threadId, workflowSteps]);

  function handlePlanChange(input: {
    messages: PlanMessage[];
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec | null;
  }) {
    setMessages(input.messages);
    setWorkflowSteps(input.workflowSteps);
    setPlannedWorkflow(input.workflow);
  }

  function handleExecutePlan(input: {
    workflowSteps: WorkflowStep[];
    workflow: ValidatedWorkflowSpec;
  }) {
    setExecutedSteps(input.workflowSteps);
    setExecutedWorkflow(input.workflow);
    setResult(null);
    setScreen("building");
  }

  function handleBackToPlanner() {
    setScreen("plan");
  }

  function handleNewRun() {
    setMessages([]);
    setWorkflowSteps([]);
    setPlannedWorkflow(null);
    setExecutedSteps([]);
    setExecutedWorkflow(null);
    setResult(null);
    setSourceDraft("");
    setSourceContext(null);
    setPlanResetKey((previous) => previous + 1);
    setScreen("plan");
  }

  function saveManualSource() {
    const rows = sourceDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ line: String(index + 1), value: line }));

    if (rows.length === 0) {
      setSourceContext(null);
      return;
    }

    setSourceContext(
      sourceContextSchema.parse({
        kind: "manual",
        label: "Manual source",
        content: sourceDraft,
        records: rows,
      }),
    );
  }

  async function handleSourceUpload(file: File) {
    const content = await file.text();
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    const nextSource = sourceContextSchema.parse({
      kind: "csv",
      label: file.name,
      content,
      records: parsed.data.slice(0, 20),
    });

    setSourceDraft(content);
    setSourceContext(nextSource);
  }

  if (screen === "building" && executedWorkflow) {
    return (
      <BuildingScreen
        key={`${executedWorkflow.goal}-${executedSteps.length}`}
        onComplete={(nextResult) => {
          setResult(nextResult);
          setScreen("results");
        }}
        sourceContext={sourceContext}
        steps={executedSteps}
        workflow={executedWorkflow}
      />
    );
  }

  if (screen === "results" && result) {
    return (
      <ResultsScreen
        onBackToPlanner={handleBackToPlanner}
        onNewRun={handleNewRun}
        result={result}
        steps={executedSteps}
      />
    );
  }

  return (
      <PlanScreen
      key={planResetKey}
      error={repoError}
      isHydrating={isHydrating}
      messages={messages}
      onClearSource={() => {
        setSourceDraft("");
        setSourceContext(null);
      }}
      onExecutePlan={handleExecutePlan}
      onPlanChange={handlePlanChange}
      onSaveManualSource={saveManualSource}
      onSourceDraftChange={setSourceDraft}
      onSourceUpload={handleSourceUpload}
      sourceContext={sourceContext}
      sourceDraft={sourceDraft}
      workflow={plannedWorkflow}
      workflowSteps={workflowSteps}
    />
  );
}
