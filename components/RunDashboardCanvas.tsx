"use client";

import { isNonEmptySpec, type Spec, validateSpec } from "@json-render/core";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import { registry } from "@/lib/ui/registry";
import { buildFallbackRunSpec } from "@/lib/ui/specs";
import type { RunResult } from "@/lib/workflow/schema";

interface RunDashboardCanvasProps {
  run: RunResult;
}

export function RunDashboardCanvas({ run }: RunDashboardCanvasProps) {
  const spec = resolveRunSpec(run);

  if (!spec) {
    return (
      <div className="rounded-[28px] border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
        The dashboard spec could not be rendered for this run.
      </div>
    );
  }

  return (
    <StateProvider initialState={spec.state}>
      <VisibilityProvider>
        <ActionProvider handlers={{}}>
          <Renderer registry={registry} spec={spec} />
        </ActionProvider>
      </VisibilityProvider>
    </StateProvider>
  );
}

function resolveRunSpec(run: RunResult): Spec | null {
  const uiModel = isNonEmptySpec(run.uiModel) ? run.uiModel : null;
  if (uiModel) {
    const validation = validateSpec(uiModel);
    if (validation.valid) {
      return uiModel;
    }
  }

  const fallbackSpec = buildFallbackRunSpec(run);
  if (!fallbackSpec) {
    return null;
  }

  return validateSpec(fallbackSpec).valid ? fallbackSpec : null;
}
