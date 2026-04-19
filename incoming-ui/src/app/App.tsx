import { useState, useEffect } from 'react';
import { PlanScreen, type WorkflowStep } from './components/PlanScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { BuildingScreen } from './components/BuildingScreen';

export interface SavedRun {
  id: string;
  title: string;
  timestamp: number;
  steps: WorkflowStep[];
}

type Screen = 'plan' | 'building' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('plan');
  const [executedSteps, setExecutedSteps] = useState<WorkflowStep[]>([]);
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([
    { id: 'demo-1', title: 'B2B SaaS research · 247 companies', timestamp: Date.now() - 3600000, steps: [] },
    { id: 'demo-2', title: 'Engineering candidates · 156 profiles', timestamp: Date.now() - 86400000, steps: [] },
  ]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleExecute = (steps: WorkflowStep[]) => {
    setExecutedSteps(steps);
    setScreen('building');
  };

  const handleBuildComplete = () => {
    setScreen('results');
  };

  const handleBackToPlan = () => {
    setScreen('plan');
    setExecutedSteps([]);
  };

  const handleSaveRun = (title: string) => {
    setSavedRuns((prev) => [
      { id: Date.now().toString(), title, timestamp: Date.now(), steps: executedSteps },
      ...prev,
    ]);
  };

  const handleLoadRun = (run: SavedRun) => {
    if (run.steps.length > 0) {
      setExecutedSteps(run.steps);
      setScreen('building');
    }
  };

  if (screen === 'building') {
    return <BuildingScreen steps={executedSteps} onComplete={handleBuildComplete} />;
  }

  if (screen === 'results') {
    return <ResultsScreen steps={executedSteps} onBack={handleBackToPlan} onSaveRun={handleSaveRun} />;
  }

  return <PlanScreen onExecute={handleExecute} savedRuns={savedRuns} onLoadRun={handleLoadRun} />;
}
