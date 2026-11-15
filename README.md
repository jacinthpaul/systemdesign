# Design Round

A drag-and-drop practice board for system design interviews. Pick a classic prompt, build your architecture from real components, then submit it to get a scorecard against a hidden rubric.

## Play

Open `index.html` in any modern browser. There's nothing to install or build, and it works offline (the fonts fall back to system fonts).

1. Choose a prompt from the picker at the top (URL Shortener, Chat Messenger, Video Streaming, Ride-Hailing Dispatch and more).
2. Read the brief: functional and non-functional requirements plus back-of-the-envelope numbers.
3. Drag components from the palette onto the board, or tap one to drop it in.
4. Drag from a component's right-hand dot to another component to connect them.
5. Select a component to rename it or set its instance count (×3 = three replicas).
6. **Run traffic** to animate requests from the clients and spot parts nothing reaches.
7. **Submit design** for a score out of 100, stars, a hiring verdict and the follow-up questions an interviewer would ask.

Hints are available but cost 5 points each. After submitting you can load the reference design (that attempt then no longer counts toward your best score). Progress and boards are saved in your browser's local storage.

## Advanced notes

Every prompt has an **Advanced** tab (also linked from the Brief and the Scorecard) with:

- **API design:** the core endpoints, WebSocket frames or internal RPCs with request and response shapes
- **Data model:** entities, which store holds them, partition and sort keys, and field types
- **Trade-offs:** the key decisions, the options, which one to pick and why
- **Failure modes and fixes:** what breaks, the impact, and how to recover
- **Scaling path:** how the design evolves from an MVP to global scale
- **Metrics to watch:** what you'd put on the dashboard

The notes describe a strong answer, so they're hidden behind a "Show advanced notes" button until you submit (opening them doesn't affect your score). "Open wide view" shows them in a two-column reader. The Sandbox shows a 45-minute interview framework instead.

## Components

29 building blocks in six groups: clients, edge and networking (DNS, CDN, load balancer, API gateway, rate limiter), compute (app servers, microservices, WebSocket servers, workers, serverless, schedulers), storage (SQL, read replicas, NoSQL, key-value, cache, object storage, search, geospatial index, warehouse), messaging (queues, event streams) and supporting services (auth, notifications, ID generator, ZooKeeper, monitoring).

## Scoring

Each prompt has a rubric of required components, required connections and minimum instance counts, plus extra credit. Connections count in either direction. Deductions apply for:

- clients wired directly to a database, cache, search index or queue
- components left unconnected
- hints revealed

90+ earns three stars ("Strong hire"), 70+ two, 45+ one.

## Adding a prompt

Prompts live in the `CHALLENGES` array in `index.html`. Each has requirements, a rubric built from the `N` (component present), `E` (connection between kinds) and `C` (instance count) helpers, hints, follow-up questions and a reference layout on a column/row grid.

## Tests

`tests/e2e.js` drives the app in headless Chromium (desktop plus an emulated touch phone) and checks every feature: adding, moving, connecting and deleting components, the inspector, undo, hints, scoring and deductions, the traffic animation, persistence, the timer, reference designs, the prompt picker, the sandbox and dark mode. It also checks that every prompt's reference design scores 100.

```sh
npm install playwright   # once
node tests/e2e.js
```
