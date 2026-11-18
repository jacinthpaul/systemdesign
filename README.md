# Designmate

A drag-and-drop practice board for system design interviews. Pick a classic prompt, build your architecture from real components, then submit it to get a scorecard against a hidden rubric.

## Play online

Designmate is a single static page, so it runs on GitHub Pages: **https://jacinthpaul.github.io/systemdesign/**

To turn Pages on (one time): repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick the branch that holds `index.html` and the **/ (root)** folder, and save. Every push to that branch redeploys within a minute or two. The empty `.nojekyll` file tells Pages to serve the files as they are, without a Jekyll build.

## Play

Open `index.html` in any modern browser. There's nothing to install or build, and it works offline (the fonts fall back to system fonts).

1. Choose a prompt from the picker at the top (URL Shortener, Chat Messenger, Video Streaming, Ride-Hailing Dispatch and more).
2. Read the brief: functional and non-functional requirements plus back-of-the-envelope numbers.
3. Add components from the palette: drag them onto the board, or tap one to drop it in view.
4. Drag from a component's dot onto another component to connect them.
5. Select a component to rename it or set its instance count (×3 = three replicas).
6. **Run traffic** to animate requests from the clients and spot parts nothing reaches.
7. **Submit design** for a score out of 100, stars and a hiring verdict. The scorecard also walks one request end to end through the reference design (in the Sandbox, through your own board) and lists the follow-up questions an interviewer would ask, each with a model answer you can reveal.

Hints are available but cost 5 points each. After submitting you can load the reference design (that attempt then no longer counts toward your best score). Progress and boards are saved in your browser's local storage.

### Moving around the board

| | Mouse / trackpad | Touch |
|---|---|---|
| Pan | Drag empty space, or scroll | Drag empty space with one finger |
| Zoom | Ctrl/⌘ + scroll, `+` / `−` keys, or the toolbar | Pinch (works over components too) |
| Fit everything in view | `0` key or the Fit button | Fit button |
| Undo | Ctrl/⌘ + Z or the toolbar | Toolbar |

### Layouts

- **Desktop (1180 px and wider):** components on the left, board in the middle, Brief / Inspect / Scorecard / Advanced on the right. Both side panes can be hidden from the board toolbar to give the board the full width; the choice is remembered.
- **Tablet (700–1179 px):** components become a slim rail, the side panel slides in from the right, and a bottom bar switches between Brief, Inspect, Score and Advanced. A floating bar on the board edits the selected component (instances, copy, delete, details).
- **Phone (under 700 px):** the board fills the screen. **Add** opens the components as a bottom sheet, the other sections open as sheets too, and Clear / Run traffic / the timer live in the ⋯ menu.

## Advanced notes

Every prompt has an **Advanced** tab (also linked from the Brief and the Scorecard) with:

- **API design:** the core endpoints, WebSocket frames or internal RPCs with request and response shapes
- **Data model:** entities, which store holds them, partition and sort keys, and field types
- **Trade-offs:** the key decisions, the options, which one to pick and why
- **Failure modes and fixes:** what breaks, the impact, and how to recover
- **Scaling path:** how the design evolves from an MVP to global scale
- **Metrics to watch:** what you'd put on the dashboard

The notes describe a strong answer, so they're hidden behind a "Show advanced notes" button until you submit (opening them doesn't affect your score). "Open wide view" shows them in a two-column reader. The Sandbox shows a 45-minute interview framework instead.

## AI system design (v2)

Version 2 adds AI to the board, based on the script *AI System Design in Plain English*: an AI agent doesn't replace the classic building blocks, it sits on top of them and adds new parts.

**15 AI components** in the palette (use the **Core / AI / All** filter at the top), grouped as in the script:

| Group | Components |
|---|---|
| Brain | LLM Gateway, Prompt Management, Agent Orchestrator, LLM |
| Hands and rules | Tool Registry (MCP), Agent Identity, Guardrails, Policy Engine |
| Knowledge and memory | RAG Retriever, Vector Database, Agent Memory |
| Teamwork and people | Specialist Agent, Human Review |
| Checking and watching | Evals, AI Observability |

Select an AI component to read what it does in plain English, a **"Say it in the interview"** line, and its **controls**: the orchestrator's step and token limits, the policy rule ("refunds up to $50 automatically"), guardrails on input and output, the agent acting with the user's own permissions, citations, memory retention, eval gates and so on. Set controls show on the component, and the rubric rewards them: pair every capability with a control.

**Six AI prompts**

- *AI solutions*, built from scratch: Store Support Agent (the "my blender arrived broken" case), Company Knowledge Assistant, LLM Gateway Platform.
- *Add AI to a design*, which start from a finished classic design so the agent is a later phase: Rider Support Agent (on Ride-Hailing Dispatch), Ask Your Files (on Cloud File Sync), AI Content Moderation (on Social News Feed). You can start from your own saved board instead, and the classic prompts' scorecards link straight to them.

**AI scoring rules**

- *Nothing reaches company systems without passing policy:* the agent must reach its tools, and every route there must go through the Policy Engine.
- Deductions for user messages reaching the agent without guardrails, the agent wired straight to business systems, and the agent calling a model without the LLM gateway.
- AI scorecards are grouped under four questions: What can it do, and what's the limit? Where do its facts come from? When does a person step in? How will we know it's working, and what does it cost?

**Attack drills** play five OWASP Top 10 for LLM risks against your board: prompt injection, excessive agency, data leakage, hallucination and runaway cost. An attack travels along your wires and stops at the first control that blocks it, or reaches your systems and reports the damage.

AI prompts' Advanced notes include tool definitions, a rollout plan (shadow mode → read-only → small actions → more case types) and launch metrics.

## Components

29 classic building blocks in six groups (plus the 15 AI components above): clients, edge and networking (DNS, CDN, load balancer, API gateway, rate limiter), compute (app servers, microservices, WebSocket servers, workers, serverless, schedulers), storage (SQL, read replicas, NoSQL, key-value, cache, object storage, search, geospatial index, warehouse), messaging (queues, event streams) and supporting services (auth, notifications, ID generator, ZooKeeper, monitoring).

## Scoring

Each prompt has a rubric of required components, required connections and minimum instance counts, plus extra credit. Connections count in either direction. Deductions apply for:

- clients wired directly to a database, cache, search index or queue
- components left unconnected
- hints revealed

90+ earns three stars ("Strong hire"), 70+ two, 45+ one.

## Adding a prompt

Prompts live in the `CHALLENGES` array in `index.html`. Each has requirements, a rubric built from the `N` (component present), `E` (connection between kinds) and `C` (instance count) helpers, hints, follow-up questions and a reference layout on a column/row grid.

## Tests

`tests/e2e.js` drives the app in headless Chromium (desktop, two tablet sizes and an emulated touch phone) and checks every feature, including pan, zoom, pinch, the drawers and sheets, the AI components and controls, the policy-gate rule and the attack drills: adding, moving, connecting and deleting components, the inspector, undo, hints, scoring and deductions, the traffic animation, persistence, the timer, reference designs, the prompt picker, the sandbox and dark mode. It also checks that every prompt's reference design (all 16) scores 100.

```sh
npm install playwright   # once
node tests/e2e.js
```
