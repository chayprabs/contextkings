import type { ComponentRegistry } from "@json-render/react";

type MetricItem = {
  label: string;
  value: string;
  hint?: string;
};

type TimelineStep = {
  label: string;
  status: "done" | "active" | "warning";
  description?: string;
};

type RankedItem = {
  label: string;
  value?: string;
  description?: string;
};

type DetailField = {
  label: string;
  value: string;
};

type ChartDatum = {
  label: string;
  value: number;
};

type CtaButton = {
  label: string;
  hint?: string;
};

type AnalyticsProgressItem = {
  label: string;
  value: number;
  note: string;
};

type AnalyticsDistributionItem = {
  label: string;
  value: number;
  note?: string;
};

type AnalyticsLeaderItem = {
  label: string;
  value: number;
  note?: string;
};

type AnalyticsDeckProps = {
  title: string;
  summary: string;
  status: string;
  headlineLabel: string;
  headlineValue: string;
  deltaLabel: string;
  deltaTone: "positive" | "neutral" | "warning";
  trend: ChartDatum[];
  progress: AnalyticsProgressItem[];
  distributionTitle: string;
  distribution: AnalyticsDistributionItem[];
  leaderboardTitle: string;
  leaderboard: AnalyticsLeaderItem[];
  notes: string[];
};

type GridVariant = "split" | "triptych";

const donutPalette = [
  "#fafafa",
  "#a1a1aa",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
];

const panelClass =
  "rounded-[16px] border border-white/[0.08] bg-[#080808] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_18px_48px_rgba(0,0,0,0.28)]";
const mutedPanelClass =
  "rounded-[14px] border border-white/[0.07] bg-white/[0.025] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const metricPanelClass =
  "rounded-[14px] border border-white/[0.08] bg-[#0b0b0b] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_12px_28px_rgba(0,0,0,0.18)]";
const labelClass = "font-mono text-[11px] uppercase tracking-[0.22em] text-white/45";

export const registry: ComponentRegistry = {
  Stack: ({ children, element }) => {
    const gap =
      element.props.gap === "sm"
        ? "gap-3"
        : element.props.gap === "lg"
          ? "gap-8"
          : "gap-5";

    return <div className={`flex flex-col ${gap}`}>{children}</div>;
  },
  Grid: ({ children, element }) => {
    const variant = (element.props.variant as GridVariant | undefined) ?? "split";
    const layout =
      variant === "triptych"
        ? "grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
        : "grid items-start gap-4 xl:grid-cols-2";

    return <div className={layout}>{children}</div>;
  },
  Header: ({ element }) => (
    <div className={`${panelClass} space-y-3 px-5 py-5 md:px-6 md:py-6`}>
      {element.props.eyebrow ? (
        <div className={labelClass}>{element.props.eyebrow}</div>
      ) : null}
      <div>
        <h2 className="text-[1.8rem] font-semibold tracking-[-0.05em] text-white md:text-[2.2rem]">
          {element.props.title}
        </h2>
        {element.props.description ? (
          <p className="mt-2 max-w-3xl text-base leading-7 text-white/58">
            {element.props.description}
          </p>
        ) : null}
      </div>
    </div>
  ),
  Notice: ({ element }) => {
    const toneClass =
      element.props.tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10"
        : element.props.tone === "danger"
          ? "border-red-400/30 bg-red-400/10"
          : "border-white/[0.08] bg-[rgba(255,255,255,0.02)]";

    return (
      <div
        className={`rounded-[14px] border px-5 py-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${toneClass}`}
      >
        <div className="text-base font-semibold tracking-[-0.02em]">
          {element.props.title}
        </div>
        <p className="mt-2 text-sm leading-6 text-white/62">
          {element.props.body}
        </p>
      </div>
    );
  },
  SectionCard: ({ children, element }) => (
    <section className={`${panelClass} px-5 py-5 md:px-6`}>
      <div className="mb-5">
        <h3 className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">
          {element.props.title}
        </h3>
        {element.props.description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            {element.props.description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  ),
  MetricStrip: ({ element }) => {
    const items = element.props.items as MetricItem[];
    const columns =
      items.length >= 4
        ? "md:grid-cols-2 xl:grid-cols-4"
        : items.length === 2
          ? "md:grid-cols-2"
          : "md:grid-cols-3";

    return (
      <div className={`grid gap-4 ${columns}`}>
        {items.map((item, index) => (
          <article
            key={`${item.label}-${index}`}
            className={`${metricPanelClass} px-4 py-4 text-white`}
          >
            <div className={labelClass}>{item.label}</div>
            <div className="mt-3 text-[2.1rem] font-semibold tracking-[-0.06em] text-white">
              {item.value}
            </div>
            {item.hint ? (
              <div className="mt-2 text-sm leading-6 text-white/55">
                {item.hint}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    );
  },
  PipelineTimeline: ({ element }) => (
    <div className="space-y-4">
      {(element.props.steps as TimelineStep[]).map((step, index) => (
        <div key={`${step.label}-${index}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={`mt-2 h-3.5 w-3.5 rounded-full ${
                step.status === "done"
                  ? "bg-white"
                  : step.status === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-400"
              }`}
            />
            {index < element.props.steps.length - 1 ? (
              <span className="mt-2 h-full w-px bg-white/10" />
            ) : null}
          </div>
          <div className="pb-4">
            <div className="text-sm font-semibold text-white">
              {step.label}
            </div>
            {step.description ? (
              <div className="mt-1 text-sm leading-6 text-white/58">
                {step.description}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  ),
  TagBar: ({ element }) => (
    <div className="space-y-3">
      {element.props.title ? (
        <div className={labelClass}>{element.props.title}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(element.props.tags as string[]).map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/72"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  ),
  RankedList: ({ element }) => (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-white">
        {element.props.title}
      </div>
      <div className="space-y-3">
        {(element.props.items as RankedItem[]).map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={`${mutedPanelClass} px-4 py-3`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium text-white">{item.label}</div>
              {item.value ? (
                <div className="font-mono text-xs uppercase tracking-[0.16em] text-white/48">
                  {item.value}
                </div>
              ) : null}
            </div>
            {item.description ? (
              <div className="mt-1 text-sm leading-6 text-white/58">
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ),
  RecordTable: ({ element }) => (
    <div className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-[rgba(255,255,255,0.02)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="border-b border-white/[0.08] bg-white/[0.02] px-4 py-4">
        <div className="text-sm font-semibold text-white">
          {element.props.title}
        </div>
        {element.props.caption ? (
          <div className="mt-1 text-sm text-white/55">
            {element.props.caption}
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {(element.props.columns as string[]).map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/42"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(element.props.rows as string[][]).map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-white/[0.06] last:border-b-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="px-4 py-3 align-top text-white/72"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
  EntityDetail: ({ element }) => (
    <div className={`${panelClass} px-5 py-5 md:px-6`}>
      <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">
        {element.props.title}
      </div>
      <dl className="mt-5 grid gap-3 md:grid-cols-2">
        {(element.props.fields as DetailField[]).map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className={`${mutedPanelClass} px-3 py-3`}
          >
            <dt className={labelClass}>{field.label}</dt>
            <dd className="mt-2 text-sm leading-6 text-white/72">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  ),
  BarChart: ({ element }) => {
    const data = element.props.data as ChartDatum[];
    const highest = Math.max(...data.map((item) => item.value), 1);

    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-white">
          {element.props.title}
        </div>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-sm text-white/74">
                <span>{item.label}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">
                  {formatCompactNumber(item.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${Math.max(8, (item.value / highest) * 100)}%`,
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.42))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  AnalyticsDeck: ({ element }) => {
    const props = element.props as AnalyticsDeckProps;
    const trend = buildLineGeometry(props.trend);
    const gradientId = `trend-${props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const distribution =
      props.distribution.length > 0
        ? props.distribution
        : [{ label: "Output", value: 1, note: "Waiting for the first run" }];
    const donutSegments = buildDonutSegments(distribution);
    const distributionTotal = distribution.reduce(
      (total, item) => total + item.value,
      0,
    );
    const leaderboardMax = Math.max(
      ...props.leaderboard.map((item) => item.value),
      1,
    );

    return (
      <section className="space-y-4">
        <div className={`${panelClass} relative overflow-hidden px-5 py-5 md:px-6`}>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_65%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className={labelClass}>Overview</div>
              <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.06em] text-white md:text-[2.25rem]">
                {props.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58 md:text-base">
                {props.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/52">
                {props.status}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/42">
                {props.headlineLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
          <article className={`${panelClass} px-5 py-5 md:px-6`}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className={labelClass}>Pipeline Performance</div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <div className="text-[3rem] font-semibold tracking-[-0.08em] text-white md:text-[3.6rem]">
                      {props.headlineValue}
                    </div>
                    <div className={`text-sm font-semibold ${deltaToneClass(props.deltaTone)}`}>
                      {props.deltaLabel}
                    </div>
                  </div>
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/42">
                  5 Stages
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
                <div className="relative">
                  <svg
                    className="h-[16rem] w-full"
                    viewBox={`0 0 ${trend.width} ${trend.height}`}
                    fill="none"
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                      </linearGradient>
                    </defs>

                    {trend.gridLines.map((y) => (
                      <line
                        key={y}
                        x1="18"
                        x2={trend.width - 18}
                        y1={y}
                        y2={y}
                        stroke="rgba(255,255,255,0.08)"
                      />
                    ))}

                    <path d={trend.areaPath} fill={`url(#${gradientId})`} />
                    <path
                      d={trend.linePath}
                      stroke="rgba(255,255,255,0.88)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />

                    {trend.points.map((point) => (
                      <g key={point.label}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          fill="rgba(0,0,0,1)"
                          r="5.5"
                          stroke="rgba(255,255,255,0.78)"
                          strokeWidth="2"
                        />
                      </g>
                    ))}
                  </svg>

                  <div className="mt-2 grid grid-cols-5 gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
                    {trend.points.map((point) => (
                      <div key={point.label} className="text-center">
                        {point.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {props.progress.map((item) => (
                  <div key={item.label} className={`${mutedPanelClass} px-4 py-4`}>
                    <div className={labelClass}>{item.label}</div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="text-2xl font-semibold tracking-[-0.05em] text-white">
                        {item.value}%
                      </span>
                      <span className="text-xs text-white/44">{item.note}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(8, clampPercentage(item.value))}%`,
                          background:
                            "linear-gradient(90deg, rgba(255,255,255,0.88), rgba(59,130,246,0.72))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <div className="grid gap-4">
            <article className={`${panelClass} px-5 py-5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={labelClass}>{props.distributionTitle}</div>
                  <div className="mt-2 text-sm leading-6 text-white/58">
                    Signal clusters across the latest rendered output.
                  </div>
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">
                  {distribution.length} Slices
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-center">
                <div className="relative mx-auto flex h-40 w-40 items-center justify-center md:mx-0">
                  <svg className="-rotate-90" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      fill="none"
                      r="52"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="16"
                    />
                    {donutSegments.map((segment) => (
                      <circle
                        key={segment.label}
                        cx="80"
                        cy="80"
                        fill="none"
                        r="52"
                        stroke={segment.color}
                        strokeDasharray={segment.dashArray}
                        strokeDashoffset={segment.dashOffset}
                        strokeLinecap="round"
                        strokeWidth="16"
                      />
                    ))}
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-3xl font-semibold tracking-[-0.07em] text-white">
                      {formatCompactNumber(distributionTotal)}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
                      Total
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2.5">
                  {distribution.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className={`${mutedPanelClass} px-3 py-3`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                donutPalette[index % donutPalette.length],
                            }}
                          />
                          <span className="truncate text-sm text-white/76">
                            {item.label}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">
                          {formatCompactNumber(item.value)}
                        </span>
                      </div>
                      {item.note ? (
                        <div className="mt-1 text-xs text-white/42">{item.note}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className={`${panelClass} px-5 py-5`}>
              <div className={labelClass}>{props.leaderboardTitle}</div>
              <div className="mt-2 text-sm leading-6 text-white/58">
                Highest-signal entities ranked from the current run.
              </div>

              <div className="mt-5 space-y-4">
                {props.leaderboard.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white/80">{item.label}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">
                        {formatCompactNumber(item.value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(10, (item.value / leaderboardMax) * 100)}%`,
                          background:
                            "linear-gradient(90deg, rgba(255,255,255,0.92), rgba(59,130,246,0.6))",
                        }}
                      />
                    </div>
                    {item.note ? (
                      <div className="text-xs text-white/42">{item.note}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              {props.notes.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {props.notes.map((note, index) => (
                    <span
                      key={`${note}-${index}`}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/68"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          </div>
        </div>
      </section>
    );
  },
  CTAGroup: ({ element }) => (
    <div className={`${panelClass} relative h-fit overflow-hidden px-5 py-5 text-white md:px-6`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(240,205,115,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
      <div className="relative flex flex-col gap-5">
        <div>
          <div className={labelClass}>{element.props.title}</div>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/58">
            Keep moving from this run by choosing the clearest next action below.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(element.props.buttons as CtaButton[]).map((button, index) => (
            <div
              key={`${button.label}-${index}`}
              className="rounded-[16px] border border-white/[0.1] bg-black/30 px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-[-0.02em] text-white">
                    {button.label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/38">
                    {index === 0 ? "Recommended" : "Available"}
                  </div>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Next
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/58">
                {button.hint ?? describeCtaButton(button.label)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(element.props.buttons as CtaButton[]).map((button, index) => (
            <span
              key={`${button.label}-pill-${index}`}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60"
            >
              {button.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  ),
};

function buildLineGeometry(data: ChartDatum[]) {
  const width = 560;
  const height = 248;
  const paddingX = 18;
  const paddingTop = 20;
  const paddingBottom = 30;
  const series = data.length > 0 ? data : [{ label: "Output", value: 0 }];
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const usableHeight = height - paddingTop - paddingBottom;
  const stepX =
    series.length > 1 ? (width - paddingX * 2) / (series.length - 1) : 0;

  const points = series.map((item, index) => ({
    label: item.label,
    x: paddingX + stepX * index,
    y:
      height -
      paddingBottom -
      (item.value / maxValue) * usableHeight,
  }));

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const baseY = height - paddingBottom;
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? paddingX} ${baseY} L ${points[0]?.x ?? paddingX} ${baseY} Z`;
  const gridLines = [0.25, 0.5, 0.75].map(
    (ratio) => paddingTop + usableHeight * ratio,
  );

  return {
    width,
    height,
    points,
    linePath,
    areaPath,
    gridLines,
  };
}

function buildDonutSegments(items: AnalyticsDistributionItem[]) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);
  let offset = 0;

  return items.map((item, index) => {
    const dash = (item.value / total) * circumference;
    const segment = {
      label: item.label,
      color: donutPalette[index % donutPalette.length],
      dashArray: `${dash} ${Math.max(circumference - dash, 0)}`,
      dashOffset: -offset,
    };
    offset += dash;
    return segment;
  });
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function deltaToneClass(tone: AnalyticsDeckProps["deltaTone"]) {
  switch (tone) {
    case "positive":
      return "text-emerald-400";
    case "warning":
      return "text-amber-300";
    case "neutral":
      return "text-white/54";
  }
}

function describeCtaButton(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("refine")) {
    return "Narrow the shortlist with sharper filters, geography, or stage constraints.";
  }

  if (normalized.includes("export")) {
    return "Download the current record set for review, sharing, or handoff.";
  }

  if (normalized.includes("switch")) {
    return "Move to a different layout if you want another angle on the same run.";
  }

  return "Take the next step that best matches how you want to inspect this run.";
}
