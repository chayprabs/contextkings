---
name: venture-capital
description: Map venture sourcing and startup research requests into supported ContextKings company workflows. Use when the task is to discover companies by sector, geography, or stage; enrich startup records; rank them against an investment thesis; summarize trends; or prepare investor-style dashboards and reports from search filters, domains, CSVs, or manual lists.
---

# Venture Capital

Constrain investor-style research into company-centric workflows that produce a clean shortlist, thesis alignment summary, and exportable artifacts. Keep the tone analytical and memo-friendly.

## Default Mapping

- Set `entityType` to `company`.
- Prefer `company-search -> company-enrich -> llm-derive` for thematic sourcing and market scans.
- Prefer direct company enrichment when the user already provides domains, names, or IDs.
- Use `llmTask` values like `rank`, `classify`, `research`, or `summarize`.
- Render as `dashboard`, `comparison-view`, or `report`.

## Translate The Ask

- Treat PitchBook, Crunchbase, AngelList, and live-news language as source hints unless web capability is explicitly enabled.
- Rewrite unsupported proprietary-data asks into supported company search, enrich, or CSV bootstrap flows.
- Frame funding, stage, and thesis-fit requests as structured ranking or classification rather than open-ended narrative research.
- Keep person-level founder discovery as a follow-up workflow, not the primary run.

## Return

- Include company thesis fit, notable signals, segmentation by sector or geography, and a concise investor summary.
- Keep warnings explicit when funding freshness, web coverage, or source access is uncertain.

## Example Prompts

- "Find vertical AI startups in Europe and rank them against an enterprise workflow thesis."
- "Turn this list of startup domains into a VC sourcing dashboard with enrichment and segmentation."
