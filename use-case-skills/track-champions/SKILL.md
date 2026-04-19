---
name: track-champions
description: Plan champion-identification and stakeholder-tracking workflows for ContextKings using supported CrustData person search and enrichment. Use when the task is to identify likely internal advocates, rank contacts by influence or fit, review stakeholder lists from LinkedIn URLs, business emails, CSVs, or manual lists, or produce champion dashboards for sales and partnerships workflows.
---

# Track Champions

Reduce vague champion-tracking asks into a person-centric shortlist with explicit reasoning. Keep the workflow honest about what can and cannot be inferred.

## Default Mapping

- Set `entityType` to `person`.
- Prefer direct `person-enrich` when the user already has LinkedIn URLs or business emails.
- Prefer `person-search -> person-enrich -> llm-derive` when the user starts from titles, target accounts, or functions.
- Use `llmTask` values like `score`, `classify`, `rank`, or `extract-signals`.
- Render as `dashboard`, `cards-first`, or `list`.

## Translate The Ask

- Treat CRM ownership, meeting history, and product-usage language as external source hints unless the user provides a CSV or manual paste.
- Rewrite unsupported direct CRM or live product telemetry requests into supported person search, person enrich, CSV, or manual workflows.
- Describe champion status as a derived heuristic based on title, company context, and prompt instructions rather than a guaranteed truth.
- Frame monitoring requests as repeatable snapshots, not live alerts.

## Return

- Include champion likelihood, role context, company, ranking rationale, and suggested follow-up.
- Surface warnings whenever influence, intent, or relationship strength is inferred rather than directly observed.

## Example Prompts

- "Find likely champions at these target accounts and rank them by influence for outbound."
- "Use this CSV of stakeholder emails to build a champion-tracking board with reason codes."
