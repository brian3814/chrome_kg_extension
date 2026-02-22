# Knowledge Graph Chrome Extension - Architecture & Implementation Plan

## Context

Build a Chrome Manifest V3 extension that provides a knowledge graph application with persistent local storage, 2D/3D graph visualization, full CRUD operations, and LLM-powered entity extraction with user approval workflows. The extension defaults to displaying in the **Chrome Side Panel** for quick, persistent access while browsing, with a toggle to **pop out into a full tab** for a more spacious editing experience. The user's display preference (side panel vs tab) is persisted in `chrome.storage.local`.

---

## Architecture Overview

```
+======================================================================+
|                    CHROME EXTENSION (Manifest V3)                     |
|                                                                      |
|  +------------------------+     +-------------------------------+    |
|  |   CONTENT SCRIPT       |     |     SERVICE WORKER            |    |
|  |   (per web page)       |     |     (ephemeral, thin router)  |    |
|  |                        |     |                               |    |
|  |  - Page text extract   |     |  - Message routing            |    |
|  |  - Selection capture   |     |  - Context menu registration  |    |
|  |  - Readability parse   |     |  - Tab management             |    |
|  +-----------|------------+     |  - Offscreen doc lifecycle     |    |
|              |                  +--------|------------|----------+    |
|              | chrome.runtime            |            |               |
|              | .sendMessage()            |            |               |
|  +===========|===========================|============|==========+   |
|  ||              TYPED MESSAGE BUS (chrome.runtime)              ||   |
|  ||    { type, payload, requestId, source, timestamp }          ||   |
|  +===================|===========================|==============+    |
|                      |                           |                   |
|                      v                           v                   |
|  +-------------------------------------------+  +----------------+  |
|  |  SIDE PANEL / TAB PAGE (React SPA)        |  | OFFSCREEN DOC  |  |
|  |  chrome-extension://id/index.html         |  |                |  |
|  |                                           |  | - LLM fetch    |  |
|  |  +------+ +----------+ +--------------+   |  |   w/ streaming |  |
|  |  |Zustand| |React UI  | |Graph Canvas  |  |  | - Keepalive    |  |
|  |  |Store  | |Panels    | |2D/3D toggle  |  |  |   for long     |  |
|  |  +---|---+ +----------+ +--------------+   |  |   requests     |  |
|  |      |                                     |  +----------------+  |
|  |  +---|-----------------------------------+ |                      |
|  |  | DB CLIENT (postMessage to worker)     | |                      |
|  |  +---|-----------------------------------+ |                      |
|  |      | postMessage                         |                      |
|  |  +---|-----------------------------------+ |                      |
|  |  | SQLITE WEB WORKER (dedicated)         | |                      |
|  |  | wa-sqlite + OPFSCoopSyncVFS           | |                      |
|  |  | [OPFS: /kg_extension.db]              | |                      |
|  |  +---------------------------------------+ |                      |
|  +--------------------------------------------+                     |
+======================================================================+
```

**Key placement decisions:**
- **Same React SPA serves both side panel and tab.** A single `index.html` entry point is used by both `chrome.sidePanel` and the tab page. The app detects its display context and renders a responsive layout: compact in side panel (~400px width), full in tab.
- **SQLite in a dedicated web worker** spawned from the React SPA (whether it's in the side panel or tab). Both contexts share the same extension origin, so OPFS access works identically. If both are open simultaneously, `OPFSCoopSyncVFS` handles cooperative locking.
- **LLM streaming in an offscreen document.** Service workers are killed after 30s of inactivity / 5min max. LLM calls can take 60+ seconds. The offscreen document is not subject to SW lifecycle limits.
- **Service worker is a thin message router.** Holds no persistent state. Registers context menus, manages side panel/tab/offscreen lifecycle, routes messages.

### Display Modes

| | Side Panel (default) | Full Tab |
|---|---|---|
| **Width** | ~400px (Chrome-controlled) | Full viewport |
| **Graph view** | Reagraph 2D (`forceDirected2d`) with simplified controls | Reagraph 2D/3D with all controls + layout selector |
| **Panels** | Stacked/collapsible (single column) | Side-by-side (graph + detail panel) |
| **3D mode** | Disabled (too constrained at 400px) | Available via toggle (`forceDirected3d`) |
| **Clustering** | Enabled by default (essential at narrow width) | Toggle on/off |
| **Use case** | Quick reference, LLM extraction while browsing | Deep editing, large graph exploration |

- **Toggle mechanism:** A button in the app header switches between modes. "Pop out to tab" from side panel opens a new tab and optionally closes the side panel. "Dock to side panel" from tab opens the side panel and closes the tab.
- **Preference persistence:** The user's preferred default mode (`sidePanel` | `tab`) is stored in `chrome.storage.local` under key `displayMode`. The service worker reads this on `chrome.action.onClicked` to decide whether to open side panel or tab.
- **Clicking the extension icon:** Reads stored preference and opens the corresponding view. If no preference set, defaults to side panel.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Bundler | **Vite** | Fast HMR, native ESM, WASM handling, multi-entry support |
| Framework | **React 18 + TypeScript** (strict) | Rich ecosystem, force-graph React bindings, type safety across message boundaries |
| State | **Zustand** | Minimal boilerplate, works outside React (message handlers), no provider wrapping |
| Database | **wa-sqlite + OPFSCoopSyncVFS** | Only mature WASM SQLite with true OPFS persistence. Faster/more reliable than IndexedDB VFS |
| Graph Viz | **Reagraph** (`reagraph`) | Unified 2D/3D in single `GraphCanvas` component (switch via `layoutType` prop). WebGL-based in both modes. Built-in clustering by node attribute + edge aggregation. 15+ layout algorithms. ~1.5MB bundle (Three.js always included). |
| CSS | **Tailwind CSS** | Utility-first, small purged bundle |
| LLM calls | **Direct HTTP fetch** (no SDK) | SDKs add ~200KB+ each and have Node.js deps that don't work in extension contexts |
| Validation | **Zod** | Runtime validation of LLM responses, messages, forms (~13KB) |
| Page parsing | **@mozilla/readability** | Battle-tested article extraction (~15KB) |
| API key storage | **chrome.storage.local** | Encrypted at rest by Chrome, not accessible to content scripts |

---

## SQLite Schema

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Nodes
CREATE TABLE nodes (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    label       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'entity',
    properties  TEXT NOT NULL DEFAULT '{}',    -- JSON
    x           REAL,
    y           REAL,
    z           REAL,
    color       TEXT,
    size        REAL DEFAULT 1.0,
    source_url  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_label ON nodes(label);

-- Edges
CREATE TABLE edges (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'related',
    properties  TEXT NOT NULL DEFAULT '{}',
    weight      REAL DEFAULT 1.0,
    directed    INTEGER NOT NULL DEFAULT 1,
    source_url  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, target_id, label)
);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

-- Entity aliases (for entity resolution)
CREATE TABLE entity_aliases (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    node_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    alias       TEXT NOT NULL,
    alias_lower TEXT NOT NULL
);
CREATE INDEX idx_aliases_lower ON entity_aliases(alias_lower);

-- Extraction history
CREATE TABLE extraction_log (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source_url  TEXT,
    source_text TEXT,
    provider    TEXT NOT NULL,
    model       TEXT NOT NULL,
    raw_output  TEXT,
    nodes_added INTEGER DEFAULT 0,
    edges_added INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS index (migration 002)
CREATE VIRTUAL TABLE nodes_fts USING fts5(label, type, properties, content='nodes', content_rowid='rowid');
-- + sync triggers for INSERT/UPDATE/DELETE

-- Schema versioning
CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT, description TEXT);
```

Graph traversal uses recursive CTEs for N-hop neighborhood queries, shortest path, and subgraph extraction.

**Migration path to graph DB:** The schema maps cleanly to Neo4j/Memgraph — nodes become graph nodes with `type` as label, `properties` JSON as properties; edges become relationships. Export script generates Cypher `CREATE` statements.

---

## Project Structure

```
kg_extension/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.json
│   ├── offscreen.html
│   └── icons/
├── src/
│   ├── shared/              # Cross-context shared code
│   │   ├── messages.ts      # Typed message protocol
│   │   ├── types.ts         # GraphNode, GraphLink, GraphData
│   │   ├── schema.ts        # Zod validation schemas
│   │   └── constants.ts
│   ├── db/
│   │   ├── worker/
│   │   │   ├── db-worker.ts       # Web Worker entry: wa-sqlite + OPFS init
│   │   │   ├── sqlite-engine.ts   # wa-sqlite initialization
│   │   │   ├── query-executor.ts  # SQL execution + error handling
│   │   │   ├── migrations/        # Versioned schema migrations
│   │   │   └── queries/           # Node/edge CRUD, traversal, search queries
│   │   └── client/
│   │       ├── db-client.ts       # Promisified postMessage wrapper
│   │       └── db-hooks.ts        # React hooks: useQuery, useMutation
│   ├── graph/
│   │   ├── store/
│   │   │   ├── graph-store.ts     # Zustand: graph state + CRUD actions
│   │   │   ├── ui-store.ts        # Zustand: UI state (panels, mode)
│   │   │   └── llm-store.ts       # Zustand: LLM extraction state
│   │   └── transforms/
│   │       ├── db-to-reagraph.ts       # DB rows → Reagraph nodes/edges format
│   │       └── reagraph-to-db.ts       # Layout positions → DB
│   ├── llm/
│   │   ├── providers/
│   │   │   ├── base-provider.ts       # Abstract interface
│   │   │   ├── openai-provider.ts     # Direct fetch to /v1/chat/completions
│   │   │   └── anthropic-provider.ts  # Direct fetch to /v1/messages
│   │   └── extraction/
│   │       ├── extract-entities.ts    # Prompt templates + JSON parsing
│   │       ├── entity-resolution.ts   # Normalize → exact → fuzzy match
│   │       └── diff-calculator.ts     # Compute merge diff for approval UI
│   ├── content-script/
│   │   ├── index.ts
│   │   ├── page-extractor.ts      # Readability-based text extraction
│   │   └── selection-listener.ts
│   ├── service-worker/
│   │   ├── index.ts
│   │   ├── message-router.ts
│   │   ├── context-menu.ts
│   │   ├── offscreen-manager.ts
│   │   ├── sidepanel-manager.ts  # Side panel open/close/toggle
│   │   └── tab-manager.ts
│   ├── offscreen/
│   │   ├── index.ts
│   │   └── llm-executor.ts       # LLM streaming fetch
│   └── ui/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                  # Detects context (side panel vs tab), renders layout
│       ├── layouts/
│       │   ├── SidePanelLayout.tsx  # Compact single-column layout (~400px)
│       │   └── TabLayout.tsx        # Full-width layout with side-by-side panels
│       ├── components/
│       │   ├── graph/
│       │   │   ├── KnowledgeGraph.tsx    # Reagraph GraphCanvas wrapper (2D/3D via layoutType prop)
│       │   │   ├── GraphControls.tsx     # Layout, clustering, zoom, 2D/3D toggle
│       │   │   └── NodeTooltip.tsx       # Custom hover tooltip
│       │   ├── panels/
│       │   │   ├── NodeDetailPanel.tsx
│       │   │   ├── EdgeDetailPanel.tsx
│       │   │   ├── CreatePanel.tsx
│       │   │   └── PropertyEditor.tsx
│       │   ├── search/
│       │   │   ├── SearchBar.tsx
│       │   │   └── SearchResults.tsx
│       │   ├── llm/
│       │   │   ├── LLMPanel.tsx
│       │   │   ├── TextInput.tsx
│       │   │   ├── DiffView.tsx
│       │   │   └── StreamingOutput.tsx
│       │   └── settings/
│       │       └── SettingsPanel.tsx
│       └── hooks/
│           ├── useGraphData.ts        # Subscribe to graph store, apply subgraph/clustering
│           ├── useDisplayMode.ts      # Detect side panel vs tab, handle toggle
│           └── useLLMExtraction.ts
└── tests/
```

---

## Phased Implementation

### Phase 1: Foundation
**Goal:** Installable extension with side panel + tab support, SQLite works with OPFS.
- Project init: Vite multi-entry config, TypeScript, manifest.json with `wasm-unsafe-eval` CSP
- Manifest: add `sidePanel` permission, `side_panel.default_path` pointing to `index.html`
- SQLite web worker: wa-sqlite + OPFSCoopSyncVFS init, typed message handler
- DB client: promisified postMessage wrapper with request IDs and timeouts
- Migration runner + initial schema (001)
- Minimal React app: renders in both side panel and tab contexts, inits DB worker, runs migrations
- `useDisplayMode` hook: detects context via `window.innerWidth` or URL param (`?mode=sidepanel|tab`), provides toggle function
- Service worker: `chrome.action.onClicked` reads `displayMode` preference from `chrome.storage.local`, opens side panel (default) or tab accordingly
- Display mode toggle: "Pop out to tab" / "Dock to side panel" button in header, persists preference

### Phase 2: Graph Visualization + CRUD
**Goal:** See and interact with the knowledge graph with Reagraph, responsive to both layouts.
- Zustand graph store with CRUD actions
- DB-to-Reagraph data transforms (`db-to-reagraph.ts`): DB rows → `{ id, label, fill, data }` nodes and `{ id, source, target, label, data }` edges
- `KnowledgeGraph.tsx`: Reagraph `GraphCanvas` wrapper with `layoutType="forceDirected2d"` default, node coloring by type, labels, click-to-select, hover tooltips, `draggable`
- **Clustering from day one**: `clusterAttribute="type"` on GraphCanvas, edge aggregation via `aggregateEdges` — essential for target scale of 5k-50k nodes
- **Subgraph loading**: Default to N-hop neighborhood query (recursive CTE) rather than loading entire graph; expand-on-click for progressive exploration
- `SidePanelLayout`: compact single-column — graph canvas on top, collapsible detail panel below
- `TabLayout`: full-width — graph canvas takes majority, detail panel slides in from right
- Panel components: NodeDetail, EdgeDetail, Create, PropertyEditor (JSON)
- FTS search (migration 002): SearchBar + SearchResults
- GraphControls: layout selector (force-directed, hierarchical, radial, etc.), cluster toggle, zoom controls

### Phase 3: LLM Integration
**Goal:** Extract entities from text, resolve against existing graph, approve & merge.
- LLM provider abstraction + OpenAI/Anthropic implementations (direct HTTP, no SDK)
- Offscreen document for streaming LLM calls + keepalive
- Offscreen manager in service worker
- Extraction prompt engineering: structured JSON output (nodes + edges), few-shot examples
- Entity resolution pipeline: normalize → exact match (label + aliases) → fuzzy (Levenshtein 0.85 threshold)
- Diff calculator: `{ newNodes[], newEdges[], mergedNodes[], conflicts[] }`
- DiffView component: additions in green, merges in yellow, accept/reject per item
- Settings panel: masked API key input, provider/model selection
- Keys stored in chrome.storage.local

### Phase 4: Content Script + Page Integration
**Goal:** Right-click on any page to extract knowledge.
- Content script: Readability page extraction + text selection capture
- Context menus: "Extract page to KG", "Extract selection to KG"
- Message flow wiring: context menu → content script → service worker → offscreen → extension tab
- Source URL tracking on extracted nodes/edges
- Edge case: queue results if extension tab not open, replay on open

### Phase 5: 3D Mode + Polish
**Goal:** Toggle 2D/3D (tab mode only), performance optimization, error handling.
- 3D toggle in tab mode: switch Reagraph `layoutType` from `forceDirected2d` to `forceDirected3d`, `cameraMode` from `pan` to `rotate` (3D toggle hidden in side panel)
- Performance tuning for large graphs: tune clustering parameters (`linkStrengthInternal`, `linkStrengthExternal`), test with 5k-50k nodes, optimize subgraph radius
- OPFS fallback to IndexedDB VFS if unavailable
- Bundle size audit (<5MB total — higher threshold due to Reagraph/Three.js always loaded)
- Error handling, loading states, keyboard shortcuts
- Multiple layout presets: force-directed, hierarchical, radial, concentric — user can switch per use case

---

## Pitfalls & Mitigations

| # | Pitfall | Mitigation |
|---|---------|------------|
| 1 | **OPFS availability** — may not work in very old Chrome or incognito | Feature-detect at startup; fall back to `IDBBatchAtomicVFS`; set `minimum_chrome_version: 109` |
| 2 | **Service worker termination** during long LLM calls (30s idle / 5min max) | LLM streaming runs in offscreen document, not SW. Store partial results in `chrome.storage.session` |
| 3 | **Large graph rendering** — Reagraph hangs at 2,600+ nodes without clustering | Enable clustering (`clusterAttribute`) from day one; default to subgraph loading (N-hop neighborhood CTE); progressive expand-on-click; tune `linkStrengthInternal`/`linkStrengthExternal`; for 50k+ nodes, server-side pre-computed layouts |
| 4 | **Content script CSP restrictions** — some pages block scripts | Content scripts only extract DOM text + send messages; check `location.protocol` before extraction; use `activeTab` permission |
| 5 | **SQLite concurrent access** from multiple extension tabs | `OPFSCoopSyncVFS` handles cooperative locking; add retry with backoff for `SQLITE_BUSY`; detect/warn on multiple tabs via BroadcastChannel |
| 6 | **API key security** — stored in chrome.storage.local, readable by extension pages | Never expose in content scripts; mask in UI; recommend usage-limited keys; never log keys; add "clear all keys" button |
| 7 | **Bundle size** — wa-sqlite ~800KB, Reagraph+Three.js ~1.5MB (always loaded, even in 2D) | WASM loaded by worker (not main bundle); tree-shake unused Reagraph features; accept higher bundle (~4-5MB total) as tradeoff for unified 2D/3D + clustering; monitor with vite-bundle-visualizer |
| 8 | **Message passing reliability** — `sendMessage` fails if receiver not listening | Typed protocol with requestId + timeouts; store results in `chrome.storage.session` if tab closed; use long-lived ports for streaming |
| 9 | **Entity resolution false positives** — "Apple" company vs "apple" fruit | Never auto-merge; show context (source URL, type) in diff; include entity type in matching; let user reject and create separate entity |
| 10 | **Offscreen document termination** mid-LLM call | Keepalive messages every 20s during active calls; detect death + recreate + retry; store partial results |
| 11 | **Extension update breaks DB** | Migration runner with version tracking; migrations in transactions (rollback on failure); never delete columns |
| 12 | **Vite multi-entry complexity** — different output formats needed (IIFE for content scripts, ESM for workers) | Consider `@crxjs/vite-plugin` or separate Vite build passes; content scripts need IIFE output |
| 13 | **Side panel width constraints** (~400px) — graph viz cramped, nodes overlap, labels unreadable | Compact layout with simplified graph controls; reduce label font size; auto-zoom-to-fit on resize; disable 3D in side panel; provide "pop out" as escape hatch |
| 14 | **Side panel + tab open simultaneously** — both spawn DB workers, both render graph state | Use `BroadcastChannel` to sync graph state changes; `OPFSCoopSyncVFS` handles DB locking; consider single-writer pattern where tab takes priority |
| 15 | **Side panel lifecycle** — Chrome may unload side panel when hidden | Re-initialize DB worker on side panel re-open; restore UI state from Zustand persistence (optional: persist to `chrome.storage.session`) |

---

## Verification Plan

1. **Phase 1:** Load extension in `chrome://extensions` (developer mode) → click icon → side panel opens → open DevTools console → verify `DB ready` log → run manual INSERT/SELECT → click "pop out to tab" → verify tab opens → close tab → click icon again → side panel opens (preference persists)
2. **Phase 2:** Create nodes/edges via UI in side panel → verify compact layout → pop out to tab → verify full layout → edit properties → delete → search by label → reload and verify data persists across both modes
3. **Phase 3:** Enter API key in settings → paste text in LLM panel → trigger extraction → verify streaming output → review diff view → approve → verify merged into graph
4. **Phase 4:** Navigate to a webpage → right-click → "Extract to KG" → verify extraction appears in side panel → verify source URL tracked
5. **Phase 5:** In tab mode: toggle 2D→3D via layout selector → verify same graph renders in 3D → verify 3D toggle hidden in side panel → test with 5k+ nodes with clustering enabled → verify cluster grouping by type → check total extension size <5MB
