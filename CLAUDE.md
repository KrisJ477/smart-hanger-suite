# CLAUDE.md — Start Here

You are Claude, working with Kris on the Smart-Hanger System. This file loads automatically; read whichever seed docs in `docs/` apply to the task at hand. Do not start coding or proposing solutions until you've read the relevant context.

---

## Ending a session (do this every time)

Before a session ends, **fully update the docs in `docs/` and this file** to reflect the current state and **remove anything stale**. Commit the doc updates together with the code changes they describe, so the repo is always self-consistent. A new session should always start from refreshed docs and current app files — never a stale spec.

---

## How Kris works (follow this)

- **Ask before coding.** Talk through decisions first. Code is written once direction is settled, not before. Wait for an **explicit go-ahead** — directives like "let's change X" / "let's remove Y" are discussion, NOT a build order. Confirm, then wait for "go".
- **One question at a time.** Kris is often on mobile. Do not stack multiple questions in one reply. If you need several things clarified, ask the most important one and wait.
- **Do not assume.** If a detail is unclear or could go two ways, ask. Don't fill gaps with plausible-sounding defaults.
- **Do not guess facts.** When Kris asks about real-world tools, APIs, or systems (LinuxCNC, hardware, libraries, browser APIs), search or verify. He will catch you guessing.
- **Push back when you disagree.** Constructively. Kris will tell you when he's overruling.
- **Keep responses tight.** No filler, no over-explaining, no walls of bullet points. Match his energy.
- **Quick and dirty over feature-complete.** First version proves the workflow. Polish comes after real-world testing.
- **No rebuilds without authorization.** Never regenerate or replace existing code wholesale without explicit instruction.
- **Follow specs closely.** When building from a spec, raise any gap or ambiguity for discussion rather than assuming or skipping.

---

## Project summary

A set of tools for fabricating bespoke smart-hangers — assemblies of a base bar, threaded rods, and pipe clamps — from CSV files exported by Revit. Two apps share a common data layer:

1. **BOM app** (`apps/bom-app.html`) — reads the CSV, produces a bill of materials for purchasing/planning. **Built and current** — standalone HTML, multi-pane, aggregates totals, custom line items, File System Access load/reload; reads `ThreadLength` and resolves IDs via `Mark → row N` (`Comments` = bar notes).
2. **Operator widget** (`apps/operator-widget.html`) — reads the CSV, plans bar-cutting order, writes the reordered CSV to two folders, then walks an operator through assembly one atomic task at a time. **Built** as a standalone HTML production app. Optionally drives a LinuxCNC saw later (a Thomas 310 conversion — not yet started).

Apps are deliberately separate. They share the CSV ingest/cleanup/sort logic and the to-scale hanger diagram, nothing else.

> `legacy/smart-hanger-widget.jsx` is the **original hardcoded React prototype** and is now superseded by `operator-widget.html`. Keep it only as historical reference; the HTML app is the living spec.

---

## Repo layout

- `apps/` — the two standalone HTML apps
- `docs/` — living specs (01–05)
- `samples/` — sample Revit CSV export (6 hangers, HA1–HA6)
- `legacy/` — superseded prototype, reference only

---

## Seed docs — what to read for what task

| If working on...                  | Read these                                           |
|-----------------------------------|------------------------------------------------------|
| Anything                          | `docs/04-system-overview.md` (always)                     |
| Anything that touches CSV         | `docs/01-data-model.md`                                   |
| The operator widget               | `docs/02-widget-spec.md` + `apps/operator-widget.html`         |
| Bar packing / CSV export          | `docs/05-planning-and-export.md`                           |
| Saw integration / LinuxCNC        | `docs/03-linuxcnc-integration.md`                          |
| The BOM app                       | `docs/01-data-model.md` + `apps/bom-app.html`                   |

`apps/operator-widget.html` is the current production app and doubles as the living spec for the widget — data model, task generation, packing, diagram rendering, and UI are all in there. Reference it directly when discussing widget changes.

---

## Common entry points

- **"Let's work on the BOM app"** → read `04` + `01`, then open `apps/bom-app.html`. Same data layer as the widget (reads `ThreadLength`, ID via `Mark → row N`, refuses old exports and the old ID-in-Comments layout). Its `parseCSV`/`cleanHanger` are a separate copy from the widget's — sync by hand if you touch either.
- **"Let's iterate on the widget"** → read `04`, `02`, `05`, and open `apps/operator-widget.html`. Then ask what aspect he wants to work on.
- **"Saw integration / LinuxCNC stuff"** → read `04` + `03`. Verify any technical claims about LinuxCNC by searching — don't rely on memory.

---

## Things already decided (don't relitigate)

- Two apps, not one. Shared core, separate deploy.
- Both apps are **standalone HTML** (React 18 + Babel via CDN), run directly in Chrome, no build step.
- Widget granularity: one atomic action per task. No batching.
- Per-hanger task order: **LOAD BAR (only when a new bar starts) → CUT (first, mandatory) → LABEL HANGER → MARK (absolute distances, one per screen) → per clamp INSERT ROD → ATTACH CLAMP.** No feed steps.
- **Rod length = `SH_n_ThreadLength`** (family-computed cut length). `SH_n_Y` is the pipe centerline — sticker-only, never consumed. Exports without `ThreadLength` are **refused on load** (cut length isn't derivable).
- **Blank `ThreadLength` on a slot = rod-mark position** (`markOnly`): one **ROD MARK** task (pen mark with the rod-marker), no INSERT ROD, no ATTACH CLAMP, drawn as a tick + hollow ring. BOM counts it as "Rod marks", not rod mm or clamps.
- Operator works a **sequential queue through the whole file**, in the planned cut order. Free navigation via a **vertical queue rail** on the left of the framed screens.
- Skips are **component-level**: two buttons (SKIP COMPONENT / SKIP TO NEXT HANGER). Cut can't be skipped. Skipped items are amber, revisitable, and aggregated into an end-of-run reorder record.
- **Production planning** up front: enter waste bars + stock length, greedy pack (waste first), reorder the run, report stock count. **Consumed waste bars are auto-deducted** from the persisted on-hand inventory on Begin Production.
- **One folder, picked once**: the loaded folder is both input and output — no separate printer picker. Its handle is persisted in IndexedDB; next visit the load screen offers **REOPEN <folder>** (one permission click, no dialog), the picker itself opens at the remembered folder, and a restored session reconnects via File ▾ → Reconnect folder or automatically on BEGIN PRODUCTION.
- **Sticker CSV** on Begin Production: reordered rows + `Waste`-labelled leftover rows, **filler slots (`D===1`) blanked**, and **`Comments`/`Mark` swapped** so the hanger ID lands in `Comments` and the bar notes in `Mark` — the layout the Brother label template reads. One file, `Smart_Hangers_YYYY-MM-DD_HH-MM_stickers.csv`, written into the loaded folder (`_stickers` files are hidden from the CSV chooser). The old `… - production.csv` copy is gone. Download fallback when no File System Access.
- Widget UI: **full-bleed wide layout** for the per-hanger screens (`preview`/`production`/`hangerDone`) — a shared frame of thin title bar + left queue rail, with three columns in production (rail · minimap-band + task card · right control column). Degrades to a stacked layout on narrow windows. `planning`/`load`/`complete` keep centred bodies. preview mode is verification-dense; production mode is one dominant number + pictogram + minimap (always-on mark distances). Built for a big screen with keyboard / physical buttons, not necessarily touch.
- **File ▾ menu** (title bar + planning header) replaces the old RELOAD button: Reload this file · Switch CSV (if >1 in folder) · Change folder… — each discards progress, guarded by a two-step inline confirm **only when there's progress to lose**. With no live folder handle (restored session / no-FS-Access) it offers **Reconnect folder** (remembered folder, keeps progress) and **Open another folder…**, so the label never promises a reload it can't deliver.
- Input: large NEXT (right column), small BACK, two amber skip buttons. **Keyboard: Space / ArrowRight = forward, ArrowLeft = back**, single-fire (auto-repeat ignored — a held/stuck key can't advance). Maps cleanly to a 2–3-button control box / foot pedal.
- Persistence via `localStorage` (session resume); the folder handle is remembered in IndexedDB (re-permission is one click).
- CSV rows are split quote-aware (`splitCSVLine`), but the widget then **refuses any cell that still holds a comma or quote** — exports must be comma-free (Revit now writes semicolons in text fields). No line breaks inside fields. Hanger ID = `Mark` → row N; `Comments` holds the bar notes.
- **Load guards (widget `parseCSV`, added after the 2026-10-28 Simhall file):** every data row is validated before any hanger is built — (1) exact column count, (2) slot consistency: a real clamp (`D` set, `D≠1`) must have numeric `X` and `ThreadLength`, (3) no comma/quote inside a cell, (4) column layout: the ID lives in `Mark` (an ID never has whitespace) — an empty `Mark` with a filled `Comments`, or whitespace in `Mark`, is the old ID-in-Comments layout and is refused. The first failure refuses the whole file with a `Row n …` message on the load screen — never a partial load. The BOM app's `parseCSV` copy carries guard 4 only.
- LinuxCNC integration (future) via halui + Python bridge daemon. Not QtVCP, not linuxcncrsh. Axis stays visible. Manual fallback always preserved.

If Kris wants to revisit any of these, he'll say so. Don't volunteer alternatives unprompted.

---

## Open items

- **Load guard 2 vs. ROD MARK** — guard 2 refuses a real clamp (`D≠1`) with blank `ThreadLength`, which is exactly the rod-mark convention in `docs/01-data-model.md`. Rod marks can't be loaded while guard 2 stands; needs another encoding or a guard exception.
- **BOM app lacks load guards 1–3** (it has guard 4, the layout check) — sync by hand when Kris gives the go-ahead.
- **Persistent folder permission is unverified on the shop PC** — the REOPEN button relies on `requestPermission()` on a handle restored from IndexedDB; if Chrome ever answers `denied`, the app falls back to the picker (opening at the remembered folder).
- **Clamp-slot ordering in CSV export** — read-side `cleanHanger` sorts by X, but the write-side export does not. Diagnosed; fix awaits Kris's go-ahead.
- **Revit-side export script** (pyRevit) is not in this repo; only the consuming side is documented in `docs/01-data-model.md`.
- **BOM app header rigidity** — `"Family and Type"` is hard-coded; noted, currently a non-issue.
- **Deferred:** kerf input, foot-pedal / control-box hardware, same-session multi-file edge cases.
- **LinuxCNC / Thomas 310 integration** — primary future milestone, not started (`docs/03-linuxcnc-integration.md`).
