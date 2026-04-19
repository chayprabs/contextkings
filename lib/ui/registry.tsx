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

export const registry: ComponentRegistry = {
  Stack: ({ children, element }) => {
    const gap =
      element.props.gap === "sm" ? "gap-3" : element.props.gap === "lg" ? "gap-8" : "gap-5";

    return <div className={`flex flex-col ${gap}`}>{children}</div>;
  },
  Header: ({ element }) => (
    <div className="soft-panel space-y-3 rounded-[30px] px-6 py-7 md:px-7 md:py-8">
      {element.props.eyebrow ? (
        <div className="thin-label text-[#d9d4cb]">
          {element.props.eyebrow}
        </div>
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
        <div className="text-lg font-semibold tracking-[-0.03em]">{element.props.title}</div>
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
  MetricStrip: ({ element }) => (
    <div className="grid gap-4 md:grid-cols-3">
      {(element.props.items as MetricItem[]).map((item, index) => (
        <article
          key={`${item.label}-${index}`}
          className="metric-dark-card rounded-[26px] px-5 py-5 text-[var(--foreground)]"
        >
          <div className="thin-label text-[var(--accent)]">
            {item.label}
          </div>
          <div className="mt-4 text-5xl font-semibold tracking-[-0.08em] text-[var(--foreground)]">
            {item.value}
          </div>
          {item.hint ? (
            <div className="mt-3 text-sm text-[var(--muted-foreground)]">{item.hint}</div>
          ) : null}
        </article>
      ))}
    </div>
  ),
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
            <div className="text-base font-semibold text-[var(--panel-ink)]">{step.label}</div>
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
      <div className="text-base font-semibold text-[var(--panel-ink)]">{element.props.title}</div>
      <div className="space-y-3">
        {(element.props.items as RankedItem[]).map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="soft-panel-muted rounded-[22px] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium text-[var(--panel-ink)]">{item.label}</div>
              {item.value ? <div className="text-sm text-[rgba(21,19,17,0.54)]">{item.value}</div> : null}
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
        <div className="text-base font-semibold text-[var(--panel-ink)]">{element.props.title}</div>
        {element.props.caption ? (
          <div className="mt-1 text-sm text-[rgba(21,19,17,0.58)]">{element.props.caption}</div>
        ) : null}
      </div>
      <div className="overflow-x-auto bg-[rgba(255,255,255,0.12)]">
        <table className="min-w-full text-left text-sm text-[var(--panel-ink)]">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {(element.props.columns as string[]).map((column) => (
                <th key={column} className="px-4 py-3 font-medium text-[rgba(21,19,17,0.5)]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(element.props.rows as string[][]).map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--line)] last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">
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
      <div className="text-base font-semibold text-[var(--panel-ink)]">{element.props.title}</div>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        {(element.props.fields as DetailField[]).map((field, index) => (
          <div key={`${field.label}-${index}`} className="rounded-[18px] bg-[rgba(255,255,255,0.58)] px-3 py-3">
            <dt className="thin-label text-[rgba(21,19,17,0.44)]">
              {field.label}
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--panel-ink)]">{field.value}</dd>
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
        <div className="text-base font-semibold text-[var(--panel-ink)]">{element.props.title}</div>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-[var(--panel-ink)]">
                <span>{item.label}</span>
                <span className="text-[rgba(21,19,17,0.54)]">{item.value}</span>
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
