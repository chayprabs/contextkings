---
name: monitor-companies-for-signals
description: Plan company monitoring and signal extraction workflows for ContextKings using supported CrustData company search and enrichment plus capability-gated web search. Use when the task is to review a watchlist, extract company signals, summarize changes or patterns, or present a monitoring dashboard from domains, CSVs, manual lists, or structured search filters.
---

# Monitor Companies For Signals

Frame monitoring as a repeatable snapshot workflow, not a live alerting system. Optimize for watchlists, signal summaries, and explicit freshness caveats.

## Default Mapping

- Set `entityType` to `company`.
- Prefer `manual-list` or `csv` when the user already has a watchlist.
- Prefer `company-search -> company-enrich -> llm-derive` for exploratory monitoring and use `web-search` only when capability-gated access is enabled.
- Use `llmTask` values like `extract-signals`, `research`, or `summarize`.
- Render as `dashboard`, `report`, or `table-first`.

## Translate The Ask

- Treat news, website, and web-monitoring language as a request for the web capability only when the environment supports it.
- Rewrite unsupported continuous monitoring or instant alert asks into rerunnable snapshots and saved-run comparisons.
- Keep source freshness warnings visible, especially when web is disabled and the plan falls back to company search and enrich.
- Prefer known watchlists over broad discovery when the user says "monitor."

## Return

- Include signal tags, grouped watchlist segments, pipeline summary, and a clear note about whether the run used web capability or not.
- Keep warnings explicit about freshness, coverage, and unsupported connector language.

## Example Prompts

- "Monitor these portfolio companies for hiring and growth signals."
- "Build a watchlist dashboard for climate startups and extract the most relevant company signals."
