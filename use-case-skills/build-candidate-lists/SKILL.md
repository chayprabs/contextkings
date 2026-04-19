---
name: build-candidate-lists
description: Build candidate list workflows for ContextKings using supported CrustData person search and enrichment. Use when the task is to discover candidates by title, location, or company filters; enrich known LinkedIn URLs or business emails; rank people against a role; or present an export-ready candidate table, shortlist, or recruiting dashboard.
---

# Build Candidate Lists

Turn candidate discovery prompts into a person-first shortlist with clear constraints, ranking logic, and export-ready output. Keep the workflow tightly scoped to supported identifiers and filters.

## Default Mapping

- Set `entityType` to `person`.
- Prefer direct `person-enrich` for profile URLs or business emails and `person-search -> person-enrich -> llm-derive` for exploratory sourcing.
- Use `llmTask` values like `rank`, `score`, `classify`, or `cluster`.
- Render as `list`, `cards-first`, or `table-first`.

## Translate The Ask

- Treat resumes, recruiter exports, and ATS data as CSV or manual bootstrap sources.
- Rewrite unsupported live LinkedIn, social scraping, or proprietary connector asks into supported person search, person enrich, CSV, or manual-list flows.
- Keep role requirements explicit enough to support deterministic scoring and ranking.
- Prefer one role family per run so the shortlist stays coherent.

## Return

- Include candidate summary, current company, title, role-fit rationale, and a shortlist ordered for review.
- Keep the UI simple, dense, and ready for export.

## Example Prompts

- "Build a candidate list for senior product designers in Bangalore with B2B SaaS experience."
- "Use these LinkedIn URLs to rank growth marketers for a startup hiring dashboard."
