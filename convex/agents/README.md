# Convex agents

Entry points: `actions.ts` (thread CRUD, `generateResponse`, `generateReplyAndReturnText`, column tests).

## Structure

- **anan/** – Customer-facing real estate agent
  - `agent.ts` – `createAnanAgent`; composes instructions + tools
  - `instructions/` – System, realEstate, channels, toolsSummary
  - `tools/` – Property, profile, banks, handoff, knowledge, web tools
  - `search/` – Search pipeline (Serper → Stagehand), types, quality
  - `files/` – Offer formatter (offerFormatter.ts)
  - `results/` – Search and DB result types
  - `testing/` – Column tests, trace logger
- **_lib/** – Shared types, sanitize, location, constants

## Config

- `config.ts` – LLM config
- `debug.ts` – Debug logging

## Workflow (optional)

- `workflows.ts` – Durable `generateResponseWorkflow` with retries. Use
  `internal.agents.workflows.startGenerateResponseWorkflow` instead of
  `ctx.scheduler.runAfter(internal.agents.actions.generateResponse, ...)` when
  you want durable execution and automatic retries. Default path remains
  scheduler-based.
