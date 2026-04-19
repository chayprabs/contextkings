---
name: power-your-ai-sdr
description: Plan outbound SDR and AI-assisted prospecting workflows for ContextKings using supported CrustData company and person search plus enrichment. Use when the task is to build prospecting dashboards, rank accounts, surface buyer signals, or draft outreach from domains, company filters, LinkedIn URLs, business emails, CSVs, or manual lists.
---

# Power Your AI SDR

Map open-ended outbound requests onto a small set of valid ContextKings workflows. Keep the experience conversational, but keep the execution constrained to supported CrustData adapters.

## Default Mapping

- Set `entityType` to `company` for account-first prospecting and `person` for direct buyer hunting.
- Prefer `company-search -> company-enrich -> llm-derive` when the user is exploring TAM, ICP slices, or account lists.
- Prefer `person-search -> person-enrich -> llm-derive` when the user wants named buyers, champions, or persona-level shortlists.
- Use `llmTask` values like `score`, `rank`, `draft-outreach`, or `extract-signals`.
- Render as `dashboard`, `table-first`, or `cards-first`.

## Translate The Ask

- Treat LinkedIn, Apollo, Salesforce, HubSpot, and CRM language as source hints rather than native connectors.
- Rewrite unsupported live-source asks into supported search, enrich, CSV, or manual-list flows and record the rewrite in `assumptions`.
- Choose one primary entity per run when the prompt mixes accounts and buyers. Use follow-up chat turns to pivot between company and person workflows.
- Prefer direct enrichment when the prompt already contains domains, profile URLs, or business emails.

## Return

- Include account fit, contact fit, signal tags, ranking rationale, and a clear next action.
- Keep the generated UI sales-facing: pipeline summary, ranked records, export actions, and warnings about unsupported sources or missing identifiers.

## Example Prompts

- "Build a prospect list for fintech companies in India and score them for outbound."
- "Use LinkedIn profile URLs to rank senior revops leaders for a multi-threaded SDR campaign."
