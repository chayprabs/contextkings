---
name: build-prospect-lists
description: Build prospect list workflows for ContextKings using supported CrustData company or person search and enrichment. Use when the task is to discover and rank new prospects, turn search filters into an export-ready list, enrich a known set of domains or profile URLs, or present a clean prospecting table, dashboard, or ranked list.
---

# Build Prospect Lists

Turn list-building requests into clean, exportable prospecting workflows. Optimize for shortlist quality, clarity of filters, and easy follow-up refinement.

## Default Mapping

- Set `entityType` to `company` when the prompt is ambiguous and shift to `person` only when the user clearly wants named people.
- Prefer search-first flows for discovery and direct enrich flows for known domains, emails, or profile URLs.
- Use `llmTask` values like `rank`, `score`, or `classify`.
- Render as `list` or `table-first`.

## Translate The Ask

- Treat vendor names and source labels as hints, not connectors.
- Rewrite unsupported live scraping or database sync asks into supported search, enrich, CSV, or manual-list workflows.
- Keep filters explicit so the resulting `WorkflowSpec` is narrow and explainable.
- Use follow-up turns to switch from companies to people instead of forcing mixed-entity output into one run.

## Return

- Include ranking rationale, signal tags, enough columns for export, and a brief explanation of how the list was built.
- Keep the UI table-led and list-builder friendly.

## Example Prompts

- "Build a prospect list of cybersecurity startups in the US and rank them for outbound."
- "Take these company domains and turn them into a prospecting table with enrichment and scores."
