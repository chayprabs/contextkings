---
name: build-internal-sales-tools
description: Design reusable internal sales workspaces for ContextKings using chat-driven CrustData workflows, generated UI, saved runs, and export flows. Use when the task is to build a polished internal sales app, not just answer a one-off research query, and the user wants account, lead, champion, or signal workflows presented inside the three-panel product shell.
---

# Build Internal Sales Tools

Treat this use case as product shaping, not just workflow execution. Design the generated workspace so chat, canvas, and saved data reinforce one another.

## Default Mapping

- Choose one primary workflow domain per run: account research, lead enrichment, champion review, or signal monitoring.
- Set `entityType` to `company` for account-centric tools and `person` for lead or champion-centric tools.
- Prefer `dashboard` UI intent with a persistent shell, export actions, and run history.
- Use `llmTask` values like `score`, `rank`, `classify`, or `extract-signals` depending on the operator question.

## Translate The Ask

- Convert "build me a tool" language into a chat-first product flow rather than a free-form app builder.
- Preserve the three-panel shell: chat for refinement, generated canvas for insight UI, and data panel for saved runs and exports.
- Rewrite unsupported CRM automation, write-back, or live connector asks into supported search, enrich, CSV, manual-list, and export capabilities.
- Choose the closest valid workflow and record the narrowing explicitly in `assumptions`.

## Return

- Include operational dashboards, ranked tables, alerts, and clear pipeline summaries tied to the underlying `WorkflowSpec`.
- Keep the app feeling reusable and productized instead of like a single report page.

## Example Prompts

- "Build an internal sales tool that enriches target accounts and highlights warm signals."
- "Create a rep-facing workspace that ranks leads from this CSV and shows who to contact next."
