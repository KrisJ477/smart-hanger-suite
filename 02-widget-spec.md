# Operator Widget Spec

Current implementation: **`operator-widget.html`** — standalone single-file app, React 18 + Babel via CDN (cdnjs), runs directly in Chrome. No build step. (`smart-hanger-widget.jsx` is the superseded hardcoded prototype.)

## Purpose
Human-in-the-loop machine simulator and production UI. The operator works through one atomic instruction at a time, like a state machine would. Validates process logic before committing to full automation; also serves as the production UI itself, with optional saw integration on top.

## Data in
Loads the **same CSV as the BOM app**. Parse → clean (purge `D===1`, sort by position) → one hanger per row. Rod length per clamp = **`SH_n_ThreadLength`** (family-computed cut length); `Y`/centerline is unused. Old exports without `ThreadLength` are **refused on load**, and so is any damaged file (column count, slot consistency, comma/quote in a cell — the three load guards in `01-data-model.md`). Nothing is ever loaded partially.

## App flow (screens)
`load → (pickcsv) → planning → preview → production → hangerDone → … → complete`

## Layout
`preview`, `production`, and `hangerDone` share a **persistent frame**: a thin full-width title bar (`FOLDER` / `FILE` context, hanger id + position, run %, and the **File ▾** menu) and a **vertical queue rail** down the left. Only the body swaps between them, so the queue and id never jump as you move between hangers. The shell is full-bleed (wide, capped ~1640px) to use a laptop/large screen. Below a narrow breakpoint it degrades gracefully to a stacked layout (rail becomes a horizontal strip, columns stack). `load`, `planning`, and `complete` keep their own centred full-width bodies — not the frame. Built for a large screen driven by keyboard / physical buttons, not necessarily touch.

### Load
Opens a **folder** (File System Access, read-write) so outputs can be written back. One CSV inside → loads it; several → a tap-to-choose list (`pickcsv`). The app's own `…_stickers.csv` outputs (and legacy `… - production.csv` files) are hidden from the chooser. The folder handle is **remembered in IndexedDB**: on the next visit the load screen shows **REOPEN <folder>** (one `requestPermission` click, no dialog) above **OPEN ANOTHER FOLDER…**; if the browser still holds the permission it connects silently on mount. The picker (`id:"smh-dir"`, `startIn` = the remembered handle) opens at that folder anyway. Fallback (iPad/Safari, no File System Access): a plain file input; export becomes a download.

### Planning
See `05-planning-and-export.md`. Enter waste bars (length + qty) and stock length, **PLAN PRODUCTION** packs the run and reports stock count + a bar-by-bar cut plan.
- Under BEGIN PRODUCTION a one-line note says where the sticker CSV will go: the loaded folder, the remembered folder ("reconnects on Begin"), or Downloads. No separate printer picker any more.
- **BEGIN PRODUCTION** reorders the run, writes the sticker CSV into the loaded folder (see `05`), deducts the consumed waste bars from the on-hand inventory, and enters production.

### Preview (per hanger)
- To-scale diagram with parameters labelled (bar length, rod lengths = cut lengths, clamp Ø, mark positions).
- Summary table; "verify against drawing" framing.
- Shows hanger status if already touched (complete / partial / in-progress).
- START (or RESUME) → production.

### Production
Three columns inside the frame: the left **queue rail** (shared), a centre **work column**, and a right **control column**.
- **Queue rail** (left, shared): every hanger as a chip, colour-coded by status (cyan = complete, amber = partial/has-skips, dim = pending), current highlighted. Tap to jump — free movement between hangers.
- **Minimap** (top of work column): a centred band sized for visibility from the workstation (~29vh) — to-scale hanger with the active component highlighted; **mark distances always shown** (muted) for double-checking. Skipped components render amber.
- **Task card** (**fixed height** — never grows with the queue; the minimap band takes the rest of the work column): pictogram, label, ONE dominant tabular number, unit, one line of detail, and a reserved slot for the "previously skipped" badge.
- **Control column** (right): large **NEXT** filling the column height, small **BACK**, a spacer, then the two amber skip buttons low down (spacer guards against mis-presses).

### Hanger done
Completion/partial summary, to-scale diagram (skips in amber), NEXT HANGER (or FINISH FILE), and BACK TO HANGER.

### Complete (end of file) — reorder record
Counts (complete / partial / untouched), plus the **skip record**: reorder totals over skipped *components* (base bar mm, rod pcs + mm, clamps by Ø) and a by-hanger "what's missing" list. COPY RECORD (clipboard), REVIEW HANGERS, LOAD ANOTHER FILE.

## Task sequence (per hanger)
1. **LOAD BAR** — only when this hanger is the first piece cut from a new bar (set by the planner). Number = bar length; detail = "Put this WASTE/STOCK bar on the saw."
2. **CUT BAR** — mandatory, cannot be skipped. (At this step, SKIP TO NEXT HANGER drops the whole hanger.)
3. **LABEL HANGER** — stick an ID sticker on the base bar. The hanger **ID is shown in the big display** (text-sized variant).
4. **MARK** ×n — one screen per clamp position, **absolute distance from the left end**, left → right. Marks all happen before any rod goes in. A position with a **blank `ThreadLength`** is a **ROD MARK** instead: same screen shape, rod-marker pen, and nothing follows for it (no rod, no clamp).
5. Per clamp (rod-mark positions excluded), left → right: **INSERT ROD** (rod **cut** length = `SH_n_ThreadLength`) → **ATTACH CLAMP** (clamp Ø).

## Skips (component-level)
- **SKIP COMPONENT** — drop the current rod/clamp only (enabled on INSERT_ROD / ATTACH_CLAMP).
- **SKIP TO NEXT HANGER** — mark all remaining not-done tasks in this hanger as skipped, jump to the next hanger.
- Skipped items show amber. A revisited skipped task shows a badge; pressing NEXT completes it (status flips skipped → done).
- Statuses: per task `pending | done | skipped`; per hanger derived `pending | inprogress | partial | complete`.

## Input
- NEXT (large/dominant, right column) and BACK (small). Plus the two skip buttons (amber, set apart by a spacer to prevent mis-presses).
- **Keyboard:** Space **or ArrowRight** = the primary (forward) action on the current screen; ArrowLeft = back where one exists. So a 2–3-button control box maps directly: back / advance (/ skip). Keys are **single-fire** — auto-repeat from a held or stuck key is ignored (`e.repeat`), so a stuck button can't run through tasks. Ignored while typing in inputs and while the File menu is open; the forward key's page-scroll is suppressed.
- Open question: hardware form. A foot pedal or button emitting Space/Right would drive NEXT hands-free.

## Task types & pictograms
`LOAD_BAR` (bar lowering onto saw bed), `CUT_BAR` (bar + cut line), `LABEL_HANGER` (sticker on bar), `MARK` (marker pen + dimension from left), `ROD_MARK` (marker pen + ringed mark — pen only, nothing fitted), `INSERT_ROD` (rod into bar), `ATTACH_CLAMP` (ring on rod). `FEED_BAR` is removed. In the diagram a rod-mark position is a dashed tick with a hollow ring, no rod, no clamp.

## Persistence
`localStorage` saves hangers (tasks stripped, regenerated on load), statuses, file name, screen, indices, waste/stock inputs, plan, and the raw CSV parts needed for export. Reopening resumes the session. Cleared when a new file is loaded or the queue is empty. The **folder handle is persisted in IndexedDB**; after a browser restart it needs one permission click (REOPEN on the load screen, or File ▾ → Reconnect folder), which BEGIN PRODUCTION also does on its own.

## File ▾ menu
In the title bar of the framed screens **and on the planning header** (so the loaded CSV/folder can always be changed). Replaces the old single RELOAD button (ambiguous once we pick a folder). Shows the current `FOLDER`/`FILE` so the target is visible, and offers:
- **Reload this file** — re-read the current CSV from disk.
- **Switch CSV** — pick a different CSV in the current folder (shown only when the folder has more than one).
- **Change folder…** — re-pick a folder entirely (runs the folder picker → chooser).

All three discard the current plan and build progress, so each is **guarded only when there's progress to lose**: with any done/skipped task it arms a two-step inline confirm ("Discard progress & …"); on a fresh run it just acts. In-app (no browser `confirm`).

When there's **no live folder handle** (restored session, or the no-FS-Access fallback), Reload/Switch can't work, so the menu offers **Reconnect folder <name>** (re-permissions the remembered folder, keeps progress, unguarded) and **Open another folder…** (or "Open file…" on the fallback) — the label never promises a reload it can't deliver.

## Look
Dark industrial palette, saturated cyan accent (chosen to survive shop lighting), amber for prep/skip, monospace. Target: a large screen driven by keyboard / physical buttons (not necessarily touch); degrades to a stacked layout on narrow windows.
