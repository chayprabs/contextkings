---
name: power-your-deal-sourcing-platform
description: Plan deal sourcing, origination, and company discovery workflows for ContextKings using supported CrustData company search and enrichment. Use when the task is to source acquisition targets, rank companies against investment or corp-dev criteria, summarize a target universe, or build sourcing dashboards and reports from filters, domains, CSVs, or manual lists.
---

# Power Your Deal Sourcing Platform

Convert origination or sourcing language into a disciplined company-selection workflow. Keep outputs shortlist-oriented and transaction-friendly.

## Default Mapping

- Set `entityType` to `company`.
- Prefer `company-search -> company-enrich -> llm-derive` for target-universe discovery.
- Prefer direct company enrichment when the user already has a list of target names, domains, or IDs.
- Use `llmTask` values like `rank`, `classify`, `research`, or `score`.
- Render as `comparison-view`, `dashboard`, or `report`.

## Translate The Ask

- Treat broker feeds, deal databases, and live market signals as source hints unless they can be reduced to supported input adapters.
- Rewrite unsupported deal-room, live-feed, or custom integration requests into company search, enrich, CSV, or manual workflows.
- Keep the core run company-centric even if the user later wants founder or executive follow-up.
- Emphasize thesis fit, sector, geography, scale, and shortlist quality over narrative market coverage.

## Return

- Include target ranking, segmentation, notable flags, and a sourcing-ready summary that can feed downstream diligence.
- Surface warnings when the user asks for unsupported freshness guarantees or non-supported data connectors.

## Example Prompts

- "Build a deal sourcing dashboard for vertical SaaS businesses in Southeast Asia."
- "Rank this list of company domains for corp-dev relevance and show the top targets in a comparison view."
