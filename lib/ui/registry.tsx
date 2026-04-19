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
    <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(76,62,18,0.06)]">
      {element.props.eyebrow ? (
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
          {element.props.eyebrow}
        </div>
      ) : null}
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">
          {element.props.title}
        </h2>
        {element.props.description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {element.props.description}
          </p>
        ) : null}
      </div>
    </div>
  ),
  Notice: ({ element }) => {
    const toneClass =
      element.props.tone === "warning"
        ? "border-amber-300 bg-amber-50"
        : element.props.tone === "danger"
          ? "border-red-200 bg-red-50"
          : "border-[var(--line)] bg-white";

    return (
      <div className={`rounded-[22px] border px-4 py-4 ${toneClass}`}>
        <div className="text-sm font-semibold">{element.props.title}</div>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          {element.props.body}
        </p>
      </div>
    );
  },
  SectionCard: ({ children, element }) => (
    <section className="rounded-[24px] border border-[var(--line)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(76,62,18,0.05)]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-[-0.03em]">
          {element.props.title}
        </h3>
        {element.props.description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {element.props.description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  ),
  MetricStrip: ({ element }) => (
    <div className="grid gap-3 md:grid-cols-3">
      {(element.props.items as MetricItem[]).map((item, index) => (
        <article
          key={`${item.label}-${index}`}
          className="rounded-[22px] border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-4"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {item.label}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            {item.value}
          </div>
          {item.hint ? (
            <div className="mt-2 text-sm text-[var(--muted)]">{item.hint}</div>
          ) : null}
        </article>
      ))}
    </div>
  ),
  PipelineTimeline: ({ element }) => (
    <div className="space-y-3">
      {(element.props.steps as TimelineStep[]).map((step, index) => (
        <div key={`${step.label}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1 h-3.5 w-3.5 rounded-full ${
                step.status === "done"
                  ? "bg-[var(--accent)]"
                  : step.status === "warning"
                    ? "bg-amber-500"
                    : "bg-[var(--foreground)]"
              }`}
            />
            {index < element.props.steps.length - 1 ? (
              <span className="mt-2 h-full w-px bg-[var(--line)]" />
            ) : null}
          </div>
          <div className="pb-4">
            <div className="text-sm font-medium">{step.label}</div>
            {step.description ? (
              <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
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
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {element.props.title}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(element.props.tags as string[]).map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  ),
  RankedList: ({ element }) => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{element.props.title}</div>
      <div className="space-y-3">
        {(element.props.items as RankedItem[]).map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium">{item.label}</div>
              {item.value ? <div className="text-sm text-[var(--muted)]">{item.value}</div> : null}
            </div>
            {item.description ? (
              <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ),
  RecordTable: ({ element }) => (
    <div className="overflow-hidden rounded-[22px] border border-[var(--line)]">
      <div className="border-b border-[var(--line)] bg-white px-4 py-3">
        <div className="text-sm font-semibold">{element.props.title}</div>
        {element.props.caption ? (
          <div className="mt-1 text-sm text-[var(--muted)]">{element.props.caption}</div>
        ) : null}
      </div>
      <div className="overflow-x-auto bg-[var(--panel-strong)]">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {(element.props.columns as string[]).map((column) => (
                <th key={column} className="px-4 py-3 font-medium text-[var(--muted)]">
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
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-4">
      <div className="text-sm font-semibold">{element.props.title}</div>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        {(element.props.fields as DetailField[]).map((field, index) => (
          <div key={`${field.label}-${index}`} className="rounded-[16px] bg-white px-3 py-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {field.label}
            </dt>
            <dd className="mt-1 text-sm leading-6">{field.value}</dd>
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
        <div className="text-sm font-semibold">{element.props.title}</div>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className="text-[var(--muted)]">{item.value}</span>
              </div>
              <div className="h-2.5 rounded-full bg-[rgba(15,118,110,0.12)]">
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
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--foreground)] px-4 py-4 text-white">
      <div className="text-sm font-semibold">{element.props.title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(element.props.buttons as CtaButton[]).map((button, index) => (
          <span
            key={`${button.label}-${index}`}
            className="rounded-full border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.16em]"
          >
            {button.label}
          </span>
        ))}
      </div>
    </div>
  ),
};
