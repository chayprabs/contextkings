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
  "#f0cd73",
  "#6fd3c8",
  "#8ca7ff",
  "#f59e8b",
  "#d8c4ff",
];

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
        ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        : "grid gap-4 xl:grid-cols-2";

    return <div className={layout}>{children}</div>;
  },
  Header: ({ element }) => (
    <div className="soft-panel space-y-3 rounded-[30px] px-6 py-7 md:px-7 md:py-8">
      {element.props.eyebrow ? (
        <div className="thin-label text-[#d9d4cb]">{element.props.eyebrow}</div>
      ) : null}
      <div>
        <h2 className="text-[2rem] font-semibold tracking-[-0.06em] text-[var(--panel-ink)] md:text-[2.45rem]">
          {element.props.title}
        </h2>
        {element.props.description ? (
          <p className="mt-2 text-base leading-7 text-[rgba(21,19,17,0.58)]">
            {element.props.description}
          </p>
        ) : null}
      </div>
    </div>
  ),
  Notice: ({ element }) => {
    const toneClass =
      element.props.tone === "warning"
        ? "border-[rgba(201,156,47,0.5)] bg-[var(--warning-soft)]"
        : element.props.tone === "danger"
          ? "border-red-200 bg-red-50"
          : "border-[var(--line)] bg-[var(--panel)]";

    return (
      <div className={`rounded-[26px] border px-5 py-5 text-[var(--panel-ink)] ${toneClass}`}>
        <div className="text-lg font-semibold tracking-[-0.03em]">
          {element.props.title}
        </div>
        <p className="mt-2 text-base leading-7 text-[rgba(21,19,17,0.62)]">
          {element.props.body}
        </p>
      </div>
    );
  },
  SectionCard: ({ children, element }) => (
    <section className="soft-panel rounded-[30px] px-6 py-6 md:px-7">
      <div className="mb-5">
        <h3 className="text-[1.75rem] font-semibold tracking-[-0.05em] text-[var(--panel-ink)]">
          {element.props.title}
        </h3>
        {element.props.description ? (
          <p className="mt-2 max-w-3xl text-base leading-7 text-[rgba(21,19,17,0.58)]">
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
            className="metric-dark-card rounded-[26px] px-5 py-5 text-[var(--foreground)]"
          >
            <div className="thin-label text-[var(--accent)]">{item.label}</div>
            <div className="mt-4 text-5xl font-semibold tracking-[-0.08em] text-[var(--foreground)]">
              {item.value}
            </div>
            {item.hint ? (
              <div className="mt-3 text-sm text-[var(--muted-foreground)]">
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
                  ? "bg-[var(--accent)]"
                  : step.status === "warning"
                    ? "bg-amber-500"
                    : "bg-[var(--panel-ink)]"
              }`}
            />
            {index < element.props.steps.length - 1 ? (
              <span className="mt-2 h-full w-px bg-[rgba(21,19,17,0.12)]" />
            ) : null}
          </div>
          <div className="pb-4">
            <div className="text-base font-semibold text-[var(--panel-ink)]">
              {step.label}
            </div>
            {step.description ? (
              <div className="mt-1 text-base leading-7 text-[rgba(21,19,17,0.58)]">
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
        <div className="thin-label text-[rgba(21,19,17,0.54)]">
          {element.props.title}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(element.props.tags as string[]).map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="rounded-full border border-[var(--line)] bg-[rgba(21,19,17,0.04)] px-3 py-1.5 text-sm text-[var(--panel-ink)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  ),
  RankedList: ({ element }) => (
    <div className="space-y-3">
      <div className="text-base font-semibold text-[var(--panel-ink)]">
        {element.props.title}
      </div>
      <div className="space-y-3">
        {(element.props.items as RankedItem[]).map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="soft-panel-muted rounded-[22px] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium text-[var(--panel-ink)]">{item.label}</div>
              {item.value ? (
                <div className="text-sm text-[rgba(21,19,17,0.54)]">{item.value}</div>
              ) : null}
            </div>
            {item.description ? (
              <div className="mt-1 text-sm leading-6 text-[rgba(21,19,17,0.58)]">
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ),
  RecordTable: ({ element }) => (
    <div className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.38)]">
      <div className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.48)] px-4 py-4">
        <div className="text-base font-semibold text-[var(--panel-ink)]">
          {element.props.title}
        </div>
        {element.props.caption ? (
          <div className="mt-1 text-sm text-[rgba(21,19,17,0.58)]">
            {element.props.caption}
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto bg-[rgba(255,255,255,0.12)]">
        <table className="min-w-full text-left text-sm text-[var(--panel-ink)]">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {(element.props.columns as string[]).map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 font-medium text-[rgba(21,19,17,0.5)]"
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
                className="border-b border-[var(--line)] last:border-b-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="px-4 py-3 align-top"
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
    <div className="soft-panel-muted rounded-[24px] px-4 py-4">
      <div className="text-base font-semibold text-[var(--panel-ink)]">
        {element.props.title}
      </div>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        {(element.props.fields as DetailField[]).map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className="rounded-[18px] bg-[rgba(255,255,255,0.58)] px-3 py-3"
          >
            <dt className="thin-label text-[rgba(21,19,17,0.44)]">
              {field.label}
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--panel-ink)]">
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
        <div className="text-base font-semibold text-[var(--panel-ink)]">
          {element.props.title}
        </div>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-sm text-[var(--panel-ink)]">
                <span>{item.label}</span>
                <span className="text-[rgba(21,19,17,0.54)]">
                  {formatCompactNumber(item.value)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[rgba(21,19,17,0.08)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.max(8, (item.value / highest) * 100)}%` }}
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
      <section className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="thin-label text-[var(--accent)]">Visual analytics</div>
            <h2 className="mt-3 text-[2.35rem] font-semibold tracking-[-0.07em] text-foreground md:text-[2.85rem]">
              {props.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              {props.summary}
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {props.status}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <article className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#040404] p-6 text-white shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(240,205,115,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                    Pipeline performance
                  </div>
                  <div className="mt-5 text-sm text-white/56">
                    {props.headlineLabel}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-3">
                    <div className="text-5xl font-semibold tracking-[-0.08em] text-white md:text-6xl">
                      {props.headlineValue}
                    </div>
                    <div className={`text-sm font-semibold ${deltaToneClass(props.deltaTone)}`}>
                      {props.deltaLabel}
                    </div>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-white/52">
                  5 stages
                </div>
              </div>

              <div className="mt-6">
                <svg
                  className="h-[16rem] w-full"
                  viewBox={`0 0 ${trend.width} ${trend.height}`}
                  fill="none"
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                    </linearGradient>
                  </defs>

                  {trend.gridLines.map((y) => (
                    <line
                      key={y}
                      x1="18"
                      x2={trend.width - 18}
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.09)"
                    />
                  ))}

                  <path d={trend.areaPath} fill={`url(#${gradientId})`} />
                  <path
                    d={trend.linePath}
                    stroke="rgba(255,255,255,0.94)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                  />

                  {trend.points.map((point) => (
                    <g key={point.label}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        fill="rgba(4,4,4,1)"
                        r="6.5"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2.5"
                      />
                    </g>
                  ))}
                </svg>

                <div className="mt-2 grid grid-cols-5 gap-2 text-[12px] text-white/48">
                  {trend.points.map((point) => (
                    <div key={point.label} className="text-center">
                      {point.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 space-y-4 border-t border-white/8 pt-5">
                {props.progress.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/72">{item.label}</span>
                      <span className="text-sm text-white/54">{item.note}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f0cd73,#ffffff)]"
                        style={{ width: `${Math.max(8, clampPercentage(item.value))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <div className="grid gap-4">
            <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 text-white shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(111,211,200,0.18),transparent_34%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                      {props.distributionTitle}
                    </div>
                    <div className="mt-1 text-sm text-white/52">
                      Where the densest signal clusters landed in this run.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/48">
                    {distribution.length} slices
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
                        strokeWidth="18"
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
                          strokeWidth="18"
                        />
                      ))}
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-3xl font-semibold tracking-[-0.07em] text-white">
                        {formatCompactNumber(distributionTotal)}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.24em] text-white/40">
                        Total
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {distribution.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3"
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
                            <span className="truncate text-sm text-white/78">
                              {item.label}
                            </span>
                          </div>
                          <span className="text-sm text-white/58">
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
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(240,205,115,0.08),rgba(255,255,255,0.03))] p-5 text-white shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(140,167,255,0.18),transparent_34%)]" />
              <div className="relative">
                <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                  {props.leaderboardTitle}
                </div>
                <div className="mt-1 text-sm text-white/52">
                  A ranked read on the strongest surfaced entities and signals.
                </div>

                <div className="mt-5 space-y-4">
                  {props.leaderboard.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-white/80">{item.label}</span>
                        <span className="text-sm text-white/56">
                          {formatCompactNumber(item.value)}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#8ca7ff,#f0cd73)]"
                          style={{
                            width: `${Math.max(10, (item.value / leaderboardMax) * 100)}%`,
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
                  <div className="mt-6 flex flex-wrap gap-2">
                    {props.notes.map((note, index) => (
                      <span
                        key={`${note}-${index}`}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/70"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  },
  CTAGroup: ({ element }) => (
    <div className="rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[var(--panel-ink)] px-5 py-5 text-white">
      <div className="text-base font-semibold">{element.props.title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(element.props.buttons as CtaButton[]).map((button, index) => (
          <span
            key={`${button.label}-${index}`}
            className="rounded-full border border-white/16 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/84"
          >
            {button.label}
          </span>
        ))}
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
