import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  X,
  Play,
  ChevronRight,
  Database,
  Filter,
  BarChart3,
  FileText,
  Layers,
  ArrowRight,
  Zap,
  FolderOpen,
  Paperclip,
  Upload,
  Clock,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import type { SavedRun } from '../App';

export interface WorkflowStep {
  id: string;
  type: 'source' | 'filter' | 'enrich' | 'analyze' | 'output';
  label: string;
  description: string;
  confirmed: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachment?: { name: string; type: 'file' | 'paste'; preview: string };
}

interface PlanScreenProps {
  onExecute: (steps: WorkflowStep[]) => void;
  savedRuns?: SavedRun[];
  onLoadRun?: (run: SavedRun) => void;
}

const stepIcons: Record<string, React.ElementType> = {
  source: Database,
  filter: Filter,
  enrich: Layers,
  analyze: BarChart3,
  output: FileText,
};

const stepColors: Record<string, string> = {
  source: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  filter: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  enrich: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  analyze: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  output: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
};

const stepDotColors: Record<string, string> = {
  source: 'bg-blue-400',
  filter: 'bg-amber-400',
  enrich: 'bg-purple-400',
  analyze: 'bg-emerald-400',
  output: 'bg-pink-400',
};

const STARTER_SUGGESTIONS = [
  { label: 'Research B2B SaaS companies', desc: 'Series A-B, enterprise software', icon: Database },
  { label: 'Scout engineering candidates', desc: 'Senior+, distributed systems', icon: Zap },
  { label: 'Compare 3 competitors', desc: 'Side-by-side market analysis', icon: BarChart3 },
  { label: 'Monitor funding rounds', desc: 'Track recent raises in fintech', icon: Layers },
];

function generateWorkflowSteps(content: string): WorkflowStep[] {
  const lower = content.toLowerCase();

  if (lower.includes('candidate') || lower.includes('scout') || lower.includes('hire')) {
    return [
      { id: '1', type: 'source', label: 'LinkedIn + GitHub', description: 'Pull candidate profiles from LinkedIn and GitHub activity', confirmed: true },
      { id: '2', type: 'filter', label: 'Experience filter', description: 'Filter to 7+ years, relevant tech stack, active in last 6 months', confirmed: true },
      { id: '3', type: 'enrich', label: 'Enrich profiles', description: 'Add company details, education, open source contributions', confirmed: true },
      { id: '4', type: 'analyze', label: 'Score & rank', description: 'Rank by relevance score based on skills match and seniority', confirmed: true },
      { id: '5', type: 'output', label: 'Candidate cards', description: 'Generate ranked candidate cards with key metrics', confirmed: true },
    ];
  }

  if (lower.includes('compare') || lower.includes('comparison') || lower.includes('versus')) {
    return [
      { id: '1', type: 'source', label: 'Company databases', description: 'Pull data from Crunchbase, PitchBook, and public filings', confirmed: true },
      { id: '2', type: 'enrich', label: 'Market data', description: 'Add market share, growth rates, and competitive positioning', confirmed: true },
      { id: '3', type: 'analyze', label: 'Comparative analysis', description: 'Score across revenue, growth, team, and market dimensions', confirmed: true },
      { id: '4', type: 'output', label: 'Comparison table', description: 'Side-by-side comparison with feature matrix and scoring', confirmed: true },
    ];
  }

  return [
    { id: '1', type: 'source', label: 'Crunchbase + PitchBook', description: 'Pull company profiles, funding history, and team data', confirmed: true },
    { id: '2', type: 'filter', label: 'Stage & size filter', description: 'Filter to Series A-B, 50-500 employees, target verticals', confirmed: true },
    { id: '3', type: 'enrich', label: 'Enrich records', description: 'Add technographics, hiring signals, news mentions', confirmed: true },
    { id: '4', type: 'analyze', label: 'Score prospects', description: 'Rank by ICP fit score using weighted criteria', confirmed: true },
    { id: '5', type: 'output', label: 'Dashboard + table', description: 'Generate metric cards, ranked list, and exportable table', confirmed: true },
  ];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PlanScreen({ onExecute, savedRuns = [], onLoadRun }: PlanScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [generatingLabel, setGeneratingLabel] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close history popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHistory]);

  const handleSend = (content: string) => {
    if (!content.trim() && !attachment) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      attachment: attachment ? { name: attachment.name, type: 'file', preview: attachment.content.slice(0, 120) } : undefined,
    };
    setAttachment(null);
    setMessages((prev) => [...prev, userMsg]);

    setIsGenerating(true);
    setGeneratingProgress(0);
    setGeneratingLabel('Analyzing prompt…');

    const steps = generateWorkflowSteps(content);
    const labels = [
      'Analyzing prompt…',
      'Identifying data sources…',
      'Mapping pipeline steps…',
      'Optimizing workflow…',
      'Finalizing plan…',
    ];

    labels.forEach((label, i) => {
      setTimeout(() => {
        setGeneratingLabel(label);
        setGeneratingProgress(((i + 1) / labels.length) * 100);
      }, i * 450);
    });

    setTimeout(() => {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've built a ${steps.length}-step pipeline for that. Review the workflow on the right — remove any steps you don't need, then execute when ready.`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setWorkflowSteps(steps);
      setIsGenerating(false);
      setGeneratingProgress(0);
    }, labels.length * 450 + 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const removeStep = (id: string) => {
    setWorkflowSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, content: (reader.result as string).slice(0, 500) });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasWorkflow = workflowSteps.length > 0;
  const showRightPanel = hasWorkflow || isGenerating;
  const isEmptyState = messages.length === 0 && !isGenerating;

  return (
    <div className="size-full flex flex-col bg-background text-foreground">
      <AppHeader />

      <div className="flex-1 flex min-h-0">
        {/* Chat area */}
        <div className={`flex flex-col transition-all duration-300 relative ${showRightPanel ? 'w-1/2' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto pb-24">
            <div className={`mx-auto px-6 pt-6 space-y-4 ${showRightPanel ? 'max-w-2xl' : 'max-w-3xl'}`}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[55vh]">
                  <div className="mb-8 text-center">
                    <h1
                      className="text-foreground mb-3"
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}
                    >
                      What should we research?
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto" style={{ lineHeight: 1.6 }}>
                      Describe your goal in plain language. I'll design a data pipeline you can review and tweak before running.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {STARTER_SUGGESTIONS.map((s, i) => {
                      const SIcon = s.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSend(s.label)}
                          className="p-4 text-left bg-card border border-border rounded-xl hover:border-muted-foreground/40 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <SIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm text-foreground">{s.label}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{s.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        msg.role === 'user'
                          ? 'bg-foreground text-background rounded-2xl rounded-br-md'
                          : 'bg-transparent text-foreground'
                      }`}
                    >
                      {/* Attachment chip */}
                      {msg.attachment && (
                        <div className={`px-4 pt-3 ${msg.role === 'user' ? '' : ''}`}>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/10 rounded-lg text-xs">
                            <Paperclip className="w-3 h-3 opacity-60" />
                            <span className="truncate max-w-[180px]">{msg.attachment.name}</span>
                          </div>
                        </div>
                      )}
                      <div className="px-4 py-3">
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating chat input */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 px-6 pointer-events-none">
            <div className={`w-full pointer-events-auto ${showRightPanel ? 'max-w-2xl' : 'max-w-3xl'}`}>
              {/* Attachment preview */}
              {attachment && (
                <div className="mb-2 flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl w-fit">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground truncate max-w-[200px]">{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="p-0.5 hover:bg-muted rounded">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="relative bg-card border border-border rounded-2xl shadow-lg shadow-black/20 flex items-center">
                  {/* Left buttons */}
                  <div className="flex items-center gap-0.5 pl-2">
                    {/* History button — only on empty state */}
                    {isEmptyState && savedRuns.length > 0 && (
                      <div className="relative" ref={historyRef}>
                        <button
                          type="button"
                          onClick={() => setShowHistory(!showHistory)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Recent runs"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>

                        {/* History popup */}
                        {showHistory && (
                          <div className="absolute bottom-full left-0 mb-2 w-[300px] bg-background border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                            <div className="px-4 py-3 border-b border-border">
                              <p className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>Pick up where you left off</p>
                            </div>
                            <div className="max-h-[240px] overflow-y-auto">
                              {savedRuns.map((run) => (
                                <button
                                  key={run.id}
                                  type="button"
                                  onClick={() => {
                                    setShowHistory(false);
                                    onLoadRun?.(run);
                                  }}
                                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-card transition-colors border-b border-border/50 last:border-0"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                                    <Database className="w-3.5 h-3.5 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">{run.title}</p>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5" style={{ fontFamily: "'Geist Mono', monospace" }}>
                                      <Clock className="w-2.5 h-2.5" />
                                      {timeAgo(run.timestamp)}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attach file button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Attach CSV or file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.json,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={hasWorkflow ? 'Refine your workflow...' : 'Describe what you want to build...'}
                    className="flex-1 pl-2 pr-12 py-3.5 bg-transparent focus:outline-none text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() && !attachment}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-20 transition-opacity"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right panel: generating loader OR workflow */}
        {isGenerating && (
          <div className="w-1/2 border-l border-border flex flex-col items-center justify-center">
            <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32" cy="32" r="30"
                    fill="none"
                    stroke="#0070f3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - generatingProgress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#0070f3] animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-foreground mb-1" style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500 }}>
                  Building workflow
                </p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {generatingLabel}
                </p>
              </div>
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0070f3] rounded-full"
                  style={{ width: `${generatingProgress}%`, transition: 'width 0.4s ease' }}
                />
              </div>
            </div>
          </div>
        )}

        {hasWorkflow && !isGenerating && (
          <div className="w-1/2 border-l border-border flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-foreground/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-sm text-foreground">Workflow Plan</h3>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>{workflowSteps.length} steps ready</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setWorkflowSteps([]);
                    setMessages([]);
                  }}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => onExecute(workflowSteps)}
                  className="flex items-center gap-2 px-4 py-1.5 text-xs bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Play className="w-3 h-3" />
                  Execute plan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="relative">
                {workflowSteps.length > 1 && (
                  <div
                    className="absolute left-[27px] top-[32px] w-px bg-border"
                    style={{ height: `calc(100% - 64px)` }}
                  />
                )}
                <div className="space-y-1">
                  {workflowSteps.map((step) => {
                    const Icon = stepIcons[step.type] || Database;
                    const color = stepColors[step.type];
                    const dotColor = stepDotColors[step.type];
                    return (
                      <div key={step.id} className="relative group">
                        <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-card/80 transition-colors">
                          <div className="relative z-10 flex-shrink-0">
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'Geist Mono', monospace" }}>{step.type}</span>
                            </div>
                            <div className="text-sm text-foreground mb-0.5">{step.label}</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">{step.description}</div>
                          </div>
                          <button
                            onClick={() => removeStep(step.id)}
                            className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all mt-0.5"
                            title="Remove step"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
