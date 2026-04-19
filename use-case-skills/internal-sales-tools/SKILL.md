---
name: internal-sales-tools
description: Shape internal sales workspace requests into constrained ContextKings workflows with CrustData search, enrichment, scoring, and dashboard outputs. Use when the task is to build rep-facing or ops-facing sales tools for account research, lead triage, territory review, champion tracking, pipeline inspection, or saved-run dashboards from prompts, CSVs, manual lists, domains, LinkedIn URLs, or business emails.
---

# Internal Sales Tools

Translate requests for internal sales software into a chat-first workspace with strict workflow boundaries. Favor repeatable dashboards and saved runs over one-off prose answers.

## Default Mapping

- Set `entityType` to `company` for account planning and `person` for lead, champion, or rep-level workflows.
- Prefer search-first flows for exploratory asks and direct enrich flows for known domains, emails, or profile URLs.
- Use `llmTask` values like `score`, `rank`, `classify`, or `extract-signals`.
- Render as `dashboard` or `table-first` unless the user explicitly asks for a report.

## Translate The Ask

- Treat CRM, enrichment vendor, and spreadsheet names as source hints, not connectors.
- Rewrite direct sync or write-back requests into supported CSV import, manual paste, search, enrich, or export flows.
- Choose one primary operating question per run, such as account prioritization, lead triage, or champion review.
- Surface assumptions whenever the requested workflow sounds broader than the supported adapter set.

## Return

- Include scorecards, warning banners, record tables, pipeline summaries, and export options.
- Keep the generated UI operator-friendly: quick scanning, reusable runs, and clear traceability from prompt to workflow summary.

## Example Prompts

- "Build an internal sales tool that ranks open accounts by fit and recent buying signals."
- "Turn this CSV of leads into a triage dashboard with enrichments and next-step labels."
