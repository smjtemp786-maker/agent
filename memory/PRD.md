# Javsh AI Agent — PRD

## Original Problem Statement
Build a production-oriented AI computer-use agent platform ("Javsh Ai Agent"). User gives a
natural-language goal; the agent plans, uses tools (browser, files, code, documents), observes,
verifies, recovers, and asks for human approval on risky actions. Tagline: "Give the agent a goal,
not a list of clicks." Dedicated to 90's Moms and the young generation.

## User Choices
- Model brain: Claude Sonnet 4.6 (default) + Gemini 3.1 Pro
- Auth: email + password (JWT)
- Human approval system: yes (Allow Once / Allow Always / Reject)
- Capabilities: browser automation, files, code execution, document generation

## Architecture
- **Frontend**: React (three-pane workspace) — LEFT agent console, CENTER live screen preview,
  RIGHT task control & approval. Dark/light theme (next-themes), framer-motion, shadcn/ui.
  Live updates via SSE (EventSource). Fonts: Outfit / Inter / JetBrains Mono.
- **Backend**: FastAPI. Modules: `auth.py` (JWT + bcrypt + brute-force + admin seed),
  `agent_core.py` (OBSERVE→PLAN→ACT→VERIFY→RECOVER loop, event bus, approval gate),
  `agent_tools.py` (real tools), `server.py` (task/device/settings APIs + SSE).
- **Agent brain**: emergentintegrations LlmChat (Emergent Universal Key), ReAct-style JSON loop.
- **DB**: MongoDB — users, tasks, task_events, login_attempts, devices, settings.

## Real (executable) capabilities — V1
- **Browser** (Playwright headless Chromium): navigate, web search (DuckDuckGo), extract text/links,
  click, type, screenshot (streamed to center pane).
- **Files**: list / read / write within per-task workspace.
- **Documents**: real .csv, .xlsx (openpyxl), .docx (python-docx), .pdf (reportlab).
- **Code execution**: sandboxed Python subprocess (60s), HIGH-risk → requires approval.
- **Approval system**: run_python always gates; "Allow Always" whitelists per task.
- **Task state / timeline / artifacts / audit** persisted as task_events; SSE replay + live.

## Implemented (2026-06)
- ✅ Email/password JWT auth (httpOnly cookies + Bearer), admin seed, modes (Mom/Power/Developer)
- ✅ Agent orchestrator loop with planning, tool selection, observation, verification, recovery
- ✅ Real browser automation, file ops, code exec, document generation — verified end-to-end
- ✅ Human approval gate (run_python) — pause/resume/reject verified
- ✅ Three-pane workspace, SSE streaming, live screenshots, agent-loop stage indicator
- ✅ Task history, settings & permissions, about/permission-policy dialog, theme toggle
- ✅ Tested: 14/14 backend + all UI flows (100%)

## NOT implemented / stubbed (future phases)
- ⚠️ Real desktop OS control (mouse/keyboard on user's machine) — not possible in cloud sandbox
- ⚠️ Android/iOS device control — `/api/devices` is a registry stub only (no live device agent)
- Multi-agent delegation, long-term memory, form-submit verification depth

## Backlog (P1/P2)
- P1: Attach files to a task (upload → workspace); DOM-inspector view in center pane
- P1: "Allow Always" persisted per-user in settings (currently per-task)
- P2: Device-agent protocol (Android accessibility bridge)
- P2: Multi-agent (Research/Coding/Verification specialists) delegation
