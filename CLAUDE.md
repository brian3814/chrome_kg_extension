# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Manifest V3 extension providing a local-first knowledge graph with SQLite persistence (wa-sqlite + OPFS), 2D/3D graph visualization (Reagraph), and LLM-powered entity extraction. The UI runs in the Chrome Side Panel (default) or a full tab.

## Build Commands

```bash
npm run build     # TypeScript check + Vite production build
npm run dev       # Vite build in watch mode (load dist/ in chrome://extensions)
```

No test framework or linter is configured.

After building, load `dist/` as an unpacked extension in `chrome://extensions` (developer mode).

## Architecture

Five execution contexts, each with different capabilities:

- **Service Worker** (`src/service-worker/`) — Ephemeral message router. No DOM. Registers context menus, manages side panel behavior, routes messages between contexts. Must not use dynamic imports (Vite's modulePreload polyfill references `document`).
- **Side Panel / Tab** (`src/ui/`) — React 19 SPA. Same `index.html` serves both. Renders graph via Reagraph, manages state via Zustand stores in `src/graph/store/`.
- **DB SharedWorker** (`src/db/worker/`) — Pure coordinator/router. Does not run SQLite directly. The UI thread creates the Dedicated Worker (which holds SQLite with OPFS) and bridges it to the SharedWorker via a `MessageChannel`. The SharedWorker routes requests from all tab ports to the single Dedicated Worker port and broadcasts sync events. This pattern is necessary because `Worker` is not available in `SharedWorkerGlobalScope` in Chrome extensions. All SQLite calls go through a serial promise queue (`sqlite-engine.ts:serialize()`) to prevent Asyncify WASM corruption from concurrent operations.
- **Offscreen Document** (`src/offscreen/`) — Hidden page for long-running LLM streaming calls that outlive the service worker's 30s/5min lifecycle.
- **Content Script** (`src/content-script/`) — Extracts page text via @mozilla/readability. Built as IIFE (separate Vite build pass).

Communication between contexts uses `chrome.runtime.sendMessage` with typed messages defined in `src/shared/messages.ts`.

## Build System

Vite config (`vite.config.ts`) has four custom plugins:

1. **fixHtmlPlugin** — Moves `dist/src/ui/index.html` to `dist/index.html` and fixes asset paths
2. **dbWorkerPlugin** — Separate Vite build producing `dist/db-worker.js` + `dist/wa-sqlite-async.wasm` (no content hash). Required because Chrome extension CSP blocks blob: URL workers.
3. **contentScriptPlugin** — Separate IIFE build for `dist/content-script.js`
4. Standard `react()` + `tailwindcss()` plugins

Key config: `base: ''` (relative paths for chrome-extension:// URLs), `modulePreload: false` (prevents DOM-referencing polyfill in service worker).

## Chrome Extension CSP Constraints

The CSP `script-src 'self' 'wasm-unsafe-eval'` blocks all `blob:` URLs. This affects:

- **DB Worker** — Cannot use Vite's default worker bundling. Built as separate entry and loaded via `new URL('/db-worker.js', location.origin)`.
- **Reagraph text rendering** — Troika-worker-utils creates blob: URL workers internally. A shim at `src/lib/troika-worker-utils-shim.ts` redirects all execution to the main thread. Vite alias in config: `'troika-worker-utils' → 'src/lib/troika-worker-utils-shim.ts'`.

## Database Layer

`src/db/worker/sqlite-engine.ts` — Core SQLite wrapper. All operations serialized through a promise queue to prevent wa-sqlite Asyncify corruption. VFS fallback: OPFS → IDB → in-memory. **Important:** `open_v2` must be inside each VFS try/catch — never separate VFS registration from database opening (see Pitfall #11 in `ARCHITECTURE.md`).

`src/db/worker/migrations/` — Versioned migrations. FTS5 is detected at runtime via `pragma_module_list` (not compiled into default wa-sqlite WASM). Migration 002 (FTS index) is optional; search falls back to LIKE queries.

`src/db/client/db-client.ts` — UI-thread client. Sends typed `postMessage` requests with requestId-based response matching and 10s timeouts.

## Reagraph Integration

- `clusterAttribute` must only be passed for `forceDirected*` layouts (others throw)
- `sizingType="default"` reads the node `size` property directly; `"attribute"` requires a separate `sizingAttribute` prop
- Graph container must use `absolute inset-0` positioning with `min-h-0` on flex parents — Reagraph's canvas uses absolute positioning internally and needs resolved pixel dimensions

## Key Types

All shared data types are in `src/shared/types.ts`: `DbNode`, `DbEdge`, `GraphNode`, `GraphEdge`, `CreateNodeInput`, `UpdateNodeInput`, `CreateEdgeInput`, `UpdateEdgeInput`, `LLMConfig`, `DisplayMode`.

## Path Alias

`@/` maps to `src/` in both TypeScript and Vite configs.

## Detailed Documentation

See `ARCHITECTURE.md` for the full system design, SQLite schema, and comprehensive pitfall documentation.

See `docs/pitfalls/shared-worker-cannot-spawn-workers.md` for why the SharedWorker cannot create Dedicated Workers in Chrome extensions and how the UI-created worker + MessageChannel bridge pattern solves it.
