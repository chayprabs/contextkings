---
name: power-your-recruiting-platform
description: Build recruiting and talent intelligence workflows for ContextKings using supported CrustData person search and enrichment. Use when the task is to scout candidates, enrich LinkedIn or profile URLs, rank talent against a role, cluster prospects, summarize candidate pools, or turn recruiter CSVs and manual lists into candidate dashboards and reports.
---

# Power Your Recruiting Platform

Translate recruiter intent into person-first workflows with explicit limits around supported inputs. Favor candidate quality, role fit, and exportable shortlists over generic bios.

## Default Mapping

- Set `entityType` to `person`.
- Prefer direct `person-enrich` when the prompt already includes LinkedIn URLs, profile URLs, or business emails.
- Prefer `person-search -> person-enrich -> llm-derive` when the user starts from titles, functions, geographies, or current-company filters.
- Use `llmTask` values like `score`, `rank`, `classify`, `cluster`, or `summarize`.
- Render as `list`, `cards-first`, or `dashboard`.

## Translate The Ask

- Treat ATS, recruiter CRM, LinkedIn Recruiter, and resume-bank language as source hints rather than direct integrations.
- Rewrite live scraping or proprietary connector requests into supported profile-URL, business-email, search, CSV, or manual-list flows.
- Use company names as filters or source hints, but keep the run person-centric.
- Carry missing-signal and unsupported-source notes into `warnings`.

## Return

- Include role fit, seniority clues, current company, ranking rationale, and a clean candidate shortlist.
- Keep the UI recruiter-friendly: candidate cards, ranked tables, filter summaries, and export actions.

## Example Prompts

- "Use LinkedIn profile URLs to build a candidate scout for senior ML engineers in India."
- "Find heads of talent at fintech startups and rank them for a recruiting outreach campaign."
