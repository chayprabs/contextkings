import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Circle, Database, Filter, Layers, BarChart3, FileText } from 'lucide-react';
import type { WorkflowStep } from './PlanScreen';
import { AppHeader } from './AppHeader';

interface BuildingScreenProps {
  steps: WorkflowStep[];
  onComplete: () => void;
}

const stepIcons: Record<string, React.ElementType> = {
  source: Database,
  filter: Filter,
  enrich: Layers,
  analyze: BarChart3,
  output: FileText,
};

export function BuildingScreen({ steps, onComplete }: BuildingScreenProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (activeStep >= steps.length) {
      const timeout = setTimeout(onComplete, 800);
      return () => clearTimeout(timeout);
    }

    const duration = 600 + Math.random() * 800;
    const timeout = setTimeout(() => {
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
      setActiveStep((prev) => prev + 1);
    }, duration);

    return () => clearTimeout(timeout);
  }, [activeStep, steps.length, onComplete]);

  const progress = steps.length > 0 ? ((completedSteps.size) / steps.length) * 100 : 0;

  return (
    <div className="size-full flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <AppHeader />

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md px-6">
          {/* Progress ring */}
          <div className="flex justify-center mb-8">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-border"
                />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-foreground transition-all duration-500"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-muted-foreground tabular-nums" style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {completedSteps.size}/{steps.length}
                </span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2
              className="text-foreground mb-1"
              style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              Building your workspace
            </h2>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>
              {activeStep < steps.length
                ? `Running: ${steps[activeStep].label}`
                : 'Finalizing results...'}
            </p>
          </div>

          {/* Steps list */}
          <div className="space-y-1">
            {steps.map((step, idx) => {
              const Icon = stepIcons[step.type] || Database;
              const isCompleted = completedSteps.has(idx);
              const isActive = idx === activeStep;
              const isPending = idx > activeStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive ? 'bg-card border border-border' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-foreground animate-spin" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors duration-300 ${
                      isCompleted
                        ? 'text-muted-foreground'
                        : isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground/50'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>running</span>
                  )}
                  {isCompleted && (
                    <span className="ml-auto text-[10px] text-emerald-400/70" style={{ fontFamily: "'Geist Mono', monospace" }}>done</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}