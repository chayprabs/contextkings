---
name: enrich-leads
description: Run lead enrichment workflows for ContextKings using supported CrustData company and person enrich paths. Use when the task is to take known domains, company names, LinkedIn URLs, profile URLs, business emails, CSVs, or manual lists and add normalized company or person context, scores, classifications, and UI-ready summaries.
---

# Enrich Leads

Favor direct enrichment over broad discovery. Use this skill when the core value is to take an existing list and make it more useful, not to invent a brand-new universe of records.

## Default Mapping

- Infer `entityType` from identifiers: domains and company names imply `company`; LinkedIn URLs, profile URLs, and business emails imply `person`.
- Prefer `manual-list` or `csv` input modes when the user already has records in hand.
- Build the plan around direct `company-enrich` or `person-enrich` plus `llm-derive`.
- Use `llmTask` values like `summarize`, `score`, or `classify`.
- Render as `table-first` or `list`.

## Translate The Ask

- Search only when the provided records do not contain enough identifiers to enrich directly.
- Treat CRM, ad platform, and enrichment-tool names as source hints unless the user pastes actual records.
- Rewrite unsupported live sync or write-back asks into supported CSV, manual paste, enrich, and export flows.
- Preserve warnings for rows that may fail due to weak or missing identifiers.

## Return

- Include before-and-after clarity: input key, enriched summary, notable derived fields, and any failed or partial rows.
- Keep the UI dense and operational so the user can review and export quickly.

## Example Prompts

- "Enrich this CSV of company domains and classify each one by ICP fit."
- "Use these LinkedIn URLs to enrich leads and rank them for outreach readiness."
