# Smart-Hanger System Overview

## What this is
A set of tools for fabricating bespoke smart-hangers (base bar + threaded rods + pipe clamps) from Revit CSV exports.

## Components

### Shared core
- CSV ingest (`parseCSV`): split rows quote-aware (`splitCSVLine` — quoted fields may hold commas), locate header by `IronLength`, map columns by name, read up to 20 clamp slots (`MAX_SLOTS`) as **D / X / ThreadLength** (D = clamp diameter, X = position, ThreadLength = rod cut length). `Y` (pipe centerline) is **not read** — it's sticker-only. Resolve ID (`Comments` → `Mark` → row N). **Refuses old exports lacking `SH_n_ThreadLength`.**
- Cleanup (`cleanHanger`): purge filler (`D===1`), sort clamps by position.
- Hanger data model.
- To-scale 2D diagram renderer (rod drawn to ThreadLength).

> `parseCSV` and `cleanHanger` are **copied into each app**, not extracted to a shared module (a deliberate trade — each app stays one standalone file). **Both carry the same patch** (quote-aware split, read D/X/ThreadLength, `Comments → Mark → row N` ID, refuse exports lacking `ThreadLength`), so keep them in sync by hand when either changes.

### BOM app — `bom-app.html` (built)
- Standalone HTML (React via CDN). Opens empty; LOAD CSV via the File System Access picker, keeps a handle; RELOAD re-reads the same file from disk (plain-input fallback otherwise).
- Multiple CSV panes, collapsible summaries, per-pane custom line items, and a grand-total BOM across panes.
- Audience: planning / purchasing.
- **Patched for the current export** — reads `ThreadLength` for rod length and resolves IDs via `Comments → Mark → row N`, so its totals are correct.

### Operator widget — `operator-widget.html` (built)
- Standalone HTML (React via CDN). Loads the same CSV, **plans bar-cutting order** (waste bars first), reorders the run, **writes the reordered CSV to two folders** (source + printer/Documents), then drives assembly one atomic task at a time.
- Audience: shop-floor operator. Target: a large screen driven by keyboard / physical buttons (not necessarily touch); wide three-column layout that degrades to stacked on narrow windows.
- Runs at the workstation; optionally drives a LinuxCNC saw later (`03`).
- Details in `02-widget-spec.md` and `05-planning-and-export.md`.

## Why two apps not one
Different audiences, environments, lifecycles, and deploy targets. BOM is stable purchasing logic; the widget keeps evolving with planning, export, and (later) saw integration. Share the data layer, not the app.

## Working conventions
- **One question at a time during specs.** Conversational, mobile-friendly.
- **Talk first, build after.** Decisions made in dialogue; code written once they're settled, on an **explicit go-ahead** — directives like "let's change X" are discussion, not a build order.
- **Show, don't tell, where useful.** Working artifacts double as living specs.
- **Quick and dirty over feature-complete.** First version proves the workflow; polish comes after real-world testing.

## Key design principles (carried from prior decisions)
- Manual fallback always preserved when adding automation.
- Pictograms over text on the operator UI.
- One dominant number per task screen.
- Sort/clean CSV before showing anything.
- Visual verification of cleaned data before assembly starts.
- Plan cutting order up front to minimise stock use; waste bars first.
- Keyboard-drivable (Space = next) so a foot pedal can run it hands-free.
