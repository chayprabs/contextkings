import { useState, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  Share2,
  RotateCcw,
  Database,
  Clock,
  CheckCircle2,
  ChevronDown,
  X,
  Filter,
  Layers,
  BarChart3,
  FileText,
  AlertTriangle,
  Bookmark,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CompanyResearchView } from './views/CompanyResearchView';
import { CandidateListView } from './views/CandidateListView';
import { ComparisonView } from './views/ComparisonView';
import type { WorkflowStep } from './PlanScreen';
import { AppHeader } from './AppHeader';

type ViewType = 'company-research' | 'candidate-list' | 'comparison';

interface ResultsScreenProps {
  steps: WorkflowStep[];
  onBack: () => void;
  onSaveRun?: (title: string) => void;
}

const stepIcons: Record<string, React.ElementType> = {
  source: Database,
  filter: Filter,
  enrich: Layers,
  analyze: BarChart3,
  output: FileText,
};

const stepColors: Record<string, string> = {
  source: 'text-blue-400',
  filter: 'text-amber-400',
  enrich: 'text-purple-400',
  analyze: 'text-emerald-400',
  output: 'text-pink-400',
};

const stepBgColors: Record<string, string> = {
  source: 'bg-blue-500/10 border-blue-500/20',
  filter: 'bg-amber-500/10 border-amber-500/20',
  enrich: 'bg-purple-500/10 border-purple-500/20',
  analyze: 'bg-emerald-500/10 border-emerald-500/20',
  output: 'bg-pink-500/10 border-pink-500/20',
};

function detectView(steps: WorkflowStep[]): ViewType {
  const allText = steps.map((s) => s.label + ' ' + s.description).join(' ').toLowerCase();
  if (allText.includes('candidate') || allText.includes('profile') || allText.includes('linkedin')) {
    return 'candidate-list';
  }
  if (allText.includes('comparison') || allText.includes('compare') || allText.includes('side-by-side')) {
    return 'comparison';
  }
  return 'company-research';
}

export function ResultsScreen({ steps, onBack, onSaveRun }: ResultsScreenProps) {
  const [showPipeline, setShowPipeline] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [lastRefine, setLastRefine] = useState('');
  const viewType = detectView(steps);

  const runMeta = {
    'company-research': { records: 247, entity: 'Companies', duration: '12s' },
    'candidate-list': { records: 156, entity: 'Candidates', duration: '8s' },
    comparison: { records: 3, entity: 'Companies', duration: '5s' },
  }[viewType];

  const handleNewRun = () => {
    setShowSaveDialog(true);
  };

  const handleSaveAndNew = () => {
    const title = `${runMeta.entity} research · ${runMeta.records} records`;
    onSaveRun?.(title);
    setShowSaveDialog(false);
    onBack();
  };

  const handleDiscardAndNew = () => {
    setShowSaveDialog(false);
    onBack();
  };

  const handleRefine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim()) return;
    setLastRefine(refineInput);
    setRefineInput('');
    setIsRefining(true);
    // Simulate silent update
    setTimeout(() => {
      setIsRefining(false);
    }, 1800);
  };

  return (
    <div className="size-full flex flex-col bg-background text-foreground">
      {/* Header — no title */}
      <AppHeader
        hideTitle
        leftContent={
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm text-foreground">Run complete</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-4 text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                {runMeta.records} {runMeta.entity.toLowerCase()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {runMeta.duration}
              </span>
            </div>
          </div>
        }
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPipeline(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-card transition-colors text-foreground"
            >
              Pipeline
              <ChevronDown className="w-3 h-3" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-card transition-colors text-foreground">
              <Share2 className="w-3 h-3" />
              Share
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity">
              <Download className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={handleNewRun}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-card transition-colors text-foreground"
            >
              <RotateCcw className="w-3 h-3" />
              New run
            </button>
          </div>
        }
      />

      {/* Refining indicator bar */}
      {isRefining && (
        <div className="h-0.5 w-full bg-border overflow-hidden relative">
          <div className="absolute inset-0 bg-[#0070f3] animate-pulse" style={{ animation: 'refineSlide 1.2s ease-in-out infinite' }} />
          <style>{`
            @keyframes refineSlide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}

      {/* Full-screen data view */}
      <div className="flex-1 overflow-auto relative pb-20">
        {viewType === 'company-research' && <CompanyResearchView />}
        {viewType === 'candidate-list' && <CandidateListView />}
        {viewType === 'comparison' && <ComparisonView />}
      </div>

      {/* Floating refine input — no responses, just silently updates */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 px-6 pointer-events-none z-50">
        <form
          onSubmit={handleRefine}
          className="w-full max-w-2xl pointer-events-auto"
        >
          {/* Last refine echo — subtle, fades out */}
          {lastRefine && !isRefining && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <Sparkles className="w-3 h-3 text-[#0070f3]" />
              <span className="text-[11px] text-muted-foreground/60" style={{ fontFamily: "'Geist Mono', monospace" }}>
                Applied: {lastRefine}
              </span>
            </div>
          )}
          <div
            className="relative rounded-2xl flex items-center overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Subtle top glow line */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
            />
            <div className="pl-4 flex items-center">
              <Sparkles className={`w-4 h-4 ${isRefining ? 'text-white/70 animate-pulse' : 'text-white/25'}`} />
            </div>
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              placeholder={isRefining ? 'Updating results...' : 'Refine results — e.g. "only Series B companies"'}
              disabled={isRefining}
              className="flex-1 pl-3 pr-12 py-4 bg-transparent focus:outline-none text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!refineInput.trim() || isRefining}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/15 disabled:opacity-20 transition-all"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Pipeline slide-over panel */}
      {showPipeline && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPipeline(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[380px] bg-background border-l border-border flex flex-col">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm text-foreground" style={{ fontWeight: 500 }}>Pipeline details</h3>
                <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {steps.length} steps · all completed
                </p>
              </div>
              <button
                onClick={() => setShowPipeline(false)}
                className="p-1.5 rounded-lg hover:bg-card transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Steps list — no connector line, uses spacing + cards */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const Icon = stepIcons[step.type] || Database;
                  const color = stepColors[step.type];
                  const bgColor = stepBgColors[step.type];
                  return (
                    <div key={step.id}>
                      {/* Step card */}
                      <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-card/50 border border-border/50">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bgColor}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{step.label}</span>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                          <span
                            className="inline-block mt-1.5 text-[10px] text-muted-foreground/50 uppercase tracking-widest"
                            style={{ fontFamily: "'Geist Mono', monospace" }}
                          >
                            {step.type}
                          </span>
                        </div>
                      </div>
                      {/* Connector dot between steps */}
                      {idx < steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-px h-1.5 bg-border/60" />
                            <div className="w-1 h-1 rounded-full bg-border/60" />
                            <div className="w-px h-1.5 bg-border/60" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-3 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>
                <span>{runMeta.records} records processed</span>
                <span>{runMeta.duration} total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save confirmation dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)} />
          <div className="relative w-[400px] bg-background border border-border rounded-2xl p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Save this run?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Your current results will be lost if you don't save.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-3 mb-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>
                <Database className="w-3 h-3" />
                <span>{runMeta.records} {runMeta.entity.toLowerCase()}</span>
                <span className="text-border">·</span>
                <Clock className="w-3 h-3" />
                <span>{runMeta.duration}</span>
                <span className="text-border">·</span>
                <span>{steps.length} steps</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardAndNew}
                className="flex-1 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAndNew}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save & start new
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}