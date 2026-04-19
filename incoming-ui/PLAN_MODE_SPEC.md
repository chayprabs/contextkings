# ContextKings v1 — Plan Mode Architecture Spec

> This document describes the complete app architecture after the Plan Mode redesign. The old 3-panel layout (chat + canvas + data sidebar) has been replaced with a sequential screen-based flow. Use this as the source of truth when integrating the design into production.

---

## 1. High-Level Flow

The app is a **3-screen state machine**. There is no router — screen transitions are driven by a single `screen` state in `App.tsx`.

```
┌──────────┐    Execute     ┌────────────────┐    Auto-complete    ┌────────────────┐
│   PLAN   │ ─────────────► │    BUILDING    │ ──────────────────► │    RESULTS     │
│  Screen  │                │    Screen      │                     │    Screen      │
└──────────┘                └────────────────┘                     └────────────────┘
     ▲                                                                    │
     │                        "Back to planner" / "New run"               │
     └────────────────────────────────────────────────────────────────────┘
```

**State in `App.tsx`:**
```ts
type Screen = 'plan' | 'building' | 'results';

// App holds:
// - screen: Screen (which screen is active)
// - executedSteps: WorkflowStep[] (the finalized pipeline passed between screens)
```

**Transition triggers:**
| From | To | Trigger |
|------|------|---------|
| `plan` | `building` | User clicks "Execute plan" in the workflow panel header |
| `building` | `results` | All steps finish their simulated execution (auto-transitions) |
| `results` | `plan` | User clicks "Back to planner" or "New run" |

---

## 2. Shared Data Model

### `WorkflowStep` (defined in `PlanScreen.tsx`, exported)

```ts
interface WorkflowStep {
  id: string;
  type: 'source' | 'filter' | 'enrich' | 'analyze' | 'output';
  label: string;         // Short name, e.g. "Crunchbase + PitchBook"
  description: string;   // One-line explanation of what the step does
  confirmed: boolean;    // Always `true` in current design (no manual confirmation UX)
}
```

**Step types and their semantic meaning:**
| Type | Purpose | Icon | Color accent |
|------|---------|------|-------------|
| `source` | Data ingestion from external APIs/databases | `Database` | Blue |
| `filter` | Narrow down records by criteria | `Filter` | Amber |
| `enrich` | Add supplementary data to existing records | `Layers` | Purple |
| `analyze` | Score, rank, or derive insights | `BarChart3` | Emerald |
| `output` | Final deliverable format (dashboard, table, cards) | `FileText` | Pink |

### `Message` (internal to `PlanScreen`)

```ts
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
```

---

## 3. Screen 1: Plan Screen (`PlanScreen.tsx`)

### Purpose
Chat-first workflow builder. The user describes what they want in natural language, and the system generates a multi-step data pipeline they can review and modify before executing.

### Layout

The screen has **two states**:

#### State A: Empty (no workflow yet)
```
┌──────────────────────────────────────────────────────┐
│                    ContextKings                       │  ← top bar, centered text
├──────────────────────────────────────────────────────┤
│                                                      │
│              What should we research?                 │  ← hero heading
│         Describe your goal in plain language...       │  ← subtitle
│                                                      │
│    ┌──────────────┐  ┌──────────────┐                │
│    │ Research B2B  │  │ Scout eng.   │                │  ← 2x2 suggestion cards
│    │ SaaS cos...   │  │ candidates.. │                │
│    ├──────────────┤  ├──────────────┤                │
│    │ Compare 3    │  │ Monitor      │                │
│    │ competitors  │  │ funding rnds │                │
│    └──────────────┘  └──────────────┘                │
│                                                      │
│   ┌──────────────────────────────────────────┐       │
│   │ Describe what you want to build...    [→]│       │  ← floating chat input
│   └──────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

- Full-width layout, content centered with `max-w-3xl`
- 4 starter suggestion cards in a 2x2 grid (`max-w-lg`)
- Clicking a suggestion card immediately sends it as a message

#### State B: Workflow generated (split view)
```
┌──────────────────────────────────────────────────────┐
│                    ContextKings                       │
├─────────────────────────┬────────────────────────────┤
│  CHAT (50%)             │  WORKFLOW PANEL (50%)      │
│                         │                            │
│  [user bubble]          │  ⟐ Workflow Plan           │
│  [assistant reply]      │     5 steps ready          │
│                         │  [Clear] [▶ Execute plan]  │
│                         │                            │
│                         │  ┃ 🔵 SOURCE #1            │
│                         │  ┃   Crunchbase + PitchBook│
│                         │  ┃                         │
│                         │  ┃ 🟡 FILTER #2            │
│                         │  ┃   Stage & size filter   │
│                         │  ┃                         │
│                         │  ┃ 🟣 ENRICH #3            │
│                         │  ┃   Enrich records        │
│                         │  ┃                         │
│                         │  ┃ 🟢 ANALYZE #4           │
│                         │  ┃   Score prospects       │
│                         │  ┃                         │
│                         │    🩷 OUTPUT #5             │
│                         │      Dashboard + table     │
│                         │                            │
│  ┌──────────────────┐   │                            │
│  │ Refine...     [→]│   │                            │
│  └──────────────────┘   │                            │
└─────────────────────────┴────────────────────────────┘
```

- Chat area shrinks to `w-1/2`, content constrained to `max-w-2xl`
- Workflow panel appears on right at `w-1/2` with `border-l`
- Transition is animated with `transition-all duration-300`

### Chat Input Design
- **Floating** — positioned `absolute bottom-0` with `pb-5`, not docked to the bottom edge
- **Rounded pill shape** — `rounded-2xl` with `bg-card border border-border`
- **Shadow** — `shadow-lg shadow-black/20` for floating effect
- **Send button** — `ArrowRight` icon (not `Send`), inside a `rounded-xl bg-foreground text-background` button, positioned `absolute right-2` inside the input container
- **Disabled state** — send button at `opacity-20` when input is empty
- Chat area has `pb-24` to prevent content from hiding behind the floating input

### Chat Bubbles
- **User messages** — `bg-foreground text-background rounded-2xl rounded-br-md` (white on black, bottom-right corner sharp), right-aligned
- **Assistant messages** — `bg-transparent text-foreground`, no border/background, left-aligned
- Max width `80%` on both

### Workflow Panel Behavior

**Header:**
- Icon: `Sparkles` in a `w-7 h-7 rounded-lg bg-foreground/10` container
- Title: "Workflow Plan" + "{n} steps ready" subtitle
- Two buttons: "Clear" (ghost/outline) and "Execute plan" (solid `bg-foreground text-background` with `Play` icon)
- "Clear" resets both `workflowSteps` and `messages` to empty arrays (returns to State A)

**Steps list:**
- Vertical timeline line: `absolute left-[27px]` (centered on the 32px icon boxes), `w-px bg-border`
  - Starts at `top-[32px]`, height = `calc(100% - 64px)` (doesn't extend past first/last step)
  - Only renders when `workflowSteps.length > 1`
- Each step is a row with: colored icon box (left) → content (center) → delete button (right)
- Icon box: `w-8 h-8 rounded-lg border` with type-specific color classes
- Content: type label (uppercase, tiny, tracking-wide) + step label (text-sm) + description (text-xs muted)
- Delete button: `X` icon, `opacity-0 group-hover:opacity-100` — only visible on hover
- **No edit button, no confirm/tick button** — all steps are auto-confirmed
- Steps container: `space-y-1` (tight spacing since the timeline line connects them visually)

### Workflow Generation Logic (`generateWorkflowSteps`)
Currently uses keyword matching on the user's message:
- Contains "candidate"/"scout"/"hire" → 5-step candidate sourcing pipeline
- Contains "compare"/"comparison"/"versus" → 4-step comparison pipeline
- Default → 5-step company research pipeline

**For real integration:** Replace this function with an API call to your LLM backend that returns `WorkflowStep[]`. The contract is:
```ts
async function generateWorkflowSteps(userPrompt: string): Promise<WorkflowStep[]>
```

---

## 4. Screen 2: Building Screen (`BuildingScreen.tsx`)

### Purpose
Full-screen execution/loading state. Shows a visual progress indicator as each workflow step "runs" sequentially. Auto-transitions to results when all steps are done.

### Layout
```
┌──────────────────────────────────────────────────────┐
│                    ContextKings                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│                    ┌─────────┐                       │
│                    │  3 / 5  │  ← SVG progress ring  │
│                    └─────────┘                       │
│                                                      │
│              Building your workspace                 │
│              Running: Enrich records                 │
│                                                      │
│         ✅ Crunchbase + PitchBook        done        │
│         ✅ Stage & size filter           done        │
│         ⟳  Enrich records               running     │  ← spinner
│         ○  Score prospects                           │  ← dimmed
│         ○  Dashboard + table                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Animation Logic
- Steps execute one at a time via `useEffect` with `setTimeout`
- Each step takes `600 + Math.random() * 800` ms (randomized for realism)
- State tracked via `activeStep` (number) and `completedSteps` (Set<number>)
- When `activeStep >= steps.length`, waits 800ms then calls `onComplete()`

### Progress Ring
- SVG circle at `w-20 h-20`, `viewBox="0 0 80 80"`, radius 34, stroke-width 3
- Background circle in `text-border`, progress circle in `text-foreground`
- Uses `strokeDasharray` / `strokeDashoffset` for animated fill
- Center shows `{completed}/{total}` as tabular-nums text

### Step States
| State | Icon | Text color | Badge |
|-------|------|-----------|-------|
| Completed | `CheckCircle2` (emerald-400) | `text-muted-foreground` | "done" in emerald |
| Active | `Loader2` (animate-spin) | `text-foreground` | "running" in muted |
| Pending | `Circle` (muted-foreground/40) | `text-muted-foreground/50` | none |

Active step has `bg-card border border-border` highlight.

### For real integration:
Replace the setTimeout simulation with actual API execution. Fire each step sequentially (or in parallel with progress callbacks). Call `onComplete()` when all steps resolve.

---

## 5. Screen 3: Results Screen (`ResultsScreen.tsx`)

### Purpose
Full-screen data dashboard. Shows the final output of the executed pipeline — this is the "generated app" the user was building toward.

### Layout
```
┌──────────────────────────────────────────────────────┐
│ [←]│✅ Run complete  ContextKings   📊247 ⏱12s [Pipeline][Share][Export][New run] │
├──────────────────────────────────────────────────────┤
│ (optional) Pipeline: [Step1] ─ [Step2] ─ [Step3]... │  ← collapsible
├──────────────────────────────────────────────────────┤
│                                                      │
│              FULL-SCREEN DATA VIEW                   │
│       (one of 3 view types, fills viewport)          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Header
- Left section: Back arrow (`ArrowLeft`, navigates to plan screen), divider, "Run complete" with green `CheckCircle2`
- Center: "ContextKings" absolutely positioned at `left-1/2 -translate-x-1/2`
- Right section: Run metadata (record count + duration), then action buttons:
  - **Pipeline** — toggles collapsible pipeline summary (with `ChevronDown` that rotates)
  - **Share** — ghost button with `Share2` icon
  - **Export** — solid button (`bg-foreground text-background`) with `Download` icon
  - **New run** — ghost button with `RotateCcw` icon, navigates back to plan screen

### Pipeline Summary (collapsible)
- Horizontal row of step chips, each showing `CheckCircle2` + step label
- Connected by `w-4 h-px bg-border` lines between chips
- Background: `bg-card/50` with `border-b border-border`

### View Detection (`detectView`)
Examines the text content of all steps to pick the right view:
```ts
function detectView(steps: WorkflowStep[]): ViewType {
  const allText = steps.map(s => s.label + ' ' + s.description).join(' ').toLowerCase();
  if (allText.includes('candidate') || allText.includes('profile') || allText.includes('linkedin'))
    return 'candidate-list';
  if (allText.includes('comparison') || allText.includes('compare') || allText.includes('side-by-side'))
    return 'comparison';
  return 'company-research';
}
```

### View Types
Each view is a separate component in `/src/app/components/views/`:

| View | Component | Triggered by |
|------|-----------|-------------|
| Company research dashboard | `CompanyResearchView` | Default / company keywords |
| Candidate list | `CandidateListView` | "candidate", "profile", "linkedin" |
| Comparison table | `ComparisonView` | "comparison", "compare", "side-by-side" |

### Run Metadata (hardcoded per view type, replace with real data):
```ts
{
  'company-research': { records: 247, entity: 'Companies', duration: '12s' },
  'candidate-list':   { records: 156, entity: 'Candidates', duration: '8s' },
  'comparison':       { records: 3,   entity: 'Companies',  duration: '5s' },
}
```

---

## 6. Shared Top Bar Convention

Every screen has the same top bar:
```
h-12 | border-b border-border | "ContextKings" centered (text-sm tracking-wide)
```
- No logo/icon — text only, centered
- Results screen adds left/right content but keeps the title absolutely centered
- Building screen has just the centered title

---

## 7. Design Tokens & Dark Mode

Dark mode is applied via `document.documentElement.classList.add('dark')` in `App.tsx`'s `useEffect`.

Key Tailwind token mapping (from Vercel design system):
| Token | Dark value |
|-------|-----------|
| `bg-background` | `#000` (pure black) |
| `text-foreground` | `#ededed` |
| `border-border` | `#222` |
| `bg-card` | `#111` / `#1a1a` |
| `text-muted-foreground` | muted gray |
| Accent blue | `#0070f3` |

---

## 8. File Structure

```
src/app/
├── App.tsx                          # State machine: plan → building → results
├── components/
│   ├── PlanScreen.tsx               # Screen 1: chat + workflow builder
│   ├���─ BuildingScreen.tsx           # Screen 2: execution animation
│   ├── ResultsScreen.tsx            # Screen 3: full-screen data dashboard
│   ├── views/
│   │   ├── CompanyResearchView.tsx  # Dashboard with metrics, tables, charts
│   │   ├── CandidateListView.tsx    # Ranked candidate cards
│   │   └── ComparisonView.tsx       # Side-by-side comparison table
│   ├── MetricCard.tsx               # Reusable: single KPI card
│   ├── SectionCard.tsx              # Reusable: titled content section
│   ├── RecordTable.tsx              # Reusable: data table
│   ├── RankedList.tsx               # Reusable: ordered list with scores
│   ├── EntityCard.tsx               # Reusable: entity detail card
│   ├── ChatPanel.tsx                # LEGACY (unused, can remove)
│   ├── CanvasPanel.tsx              # LEGACY (unused, can remove)
│   └── DataPanel.tsx                # LEGACY (unused, can remove)
```

---

## 9. Integration Checklist

When connecting this to a real backend:

- [ ] **Replace `generateWorkflowSteps()`** in `PlanScreen.tsx` with an API call to your LLM that returns `WorkflowStep[]`
- [ ] **Replace chat simulation** — wire `Message[]` to a real conversational API (the assistant should generate both the reply text AND the workflow steps)
- [ ] **Replace `BuildingScreen` timers** — execute actual pipeline steps, report progress via callbacks or SSE
- [ ] **Replace `detectView()`** — the backend should specify which view template to render (or the output step's config should declare it)
- [ ] **Replace hardcoded view data** — views currently render mock data; wire them to real API responses
- [ ] **Replace run metadata** — record counts and duration should come from actual execution results
- [ ] **Remove legacy files** — `ChatPanel.tsx`, `CanvasPanel.tsx`, `DataPanel.tsx` are from the old 3-panel layout and are no longer imported
- [ ] **Add step reordering** (optional) — drag-to-reorder on workflow steps using `react-dnd`
- [ ] **Add "add step" button** (optional) — let users manually append custom steps to the pipeline
- [ ] **Persist runs** — save executed workflows + results to Supabase for history/replay
