# Production Planning & CSV Export

Lives in the operator widget (`operator-widget.html`). Runs once after load, before assembly.

## Inputs (planning screen)
- **Waste bars on hand** — repeatable rows of `length` (mm) + `qty`. Used first. Persisted in `localStorage` and **auto-decremented** as runs consume them (see below).
- **Stock bar length** — single value (mm). Treated as unlimited supply.
- **Printer output location** — enforced folder pick (own `id:"smh-printer"`, opens at Documents). Gates BEGIN PRODUCTION. Session-scoped handle (re-pick next day). See `02`.
- No kerf — piece lengths only. (Deliberate; add a kerf input later if needed.)

## Packing algorithm (greedy)
1. Take all base bars; work **longest-first**.
2. Open a bar to cut from — **waste bars first** (expanded by qty, longest waste first), then **stock bars** (opened on demand).
3. Into the open bar, repeatedly place the **longest remaining piece that still fits**, until nothing fits.
4. Open the next bar and repeat until all pieces are placed.

Output: ordered bins (each = one physical bar with its pieces + leftover), **stock-bar count**, waste-bars-used count, and the implied **production order** (flatten bins, pieces in placement order).

Edge cases:
- A waste bar too short for anything remaining is skipped (marked unused — not counted as consumed).
- A piece longer than a fresh stock bar is **unplaceable** — parked at the end of the run and flagged in the UI (rare; base bars are <2m).

## Effect on the run
- Hangers are **reordered** into the planned cut order.
- Each hanger that is the first piece on a new bar gets a **LOAD BAR** step prepended (type + length).
- Re-planning resets progress (it reorders and regenerates the task lists) — intended to happen once, pre-production.

## Waste-bar deduction (on BEGIN PRODUCTION)
Waste bars the plan actually consumes are spoken for, so on Begin Production they're **subtracted from the persisted on-hand inventory** (matched by length): a partly-used length has its qty reduced; a fully-consumed length's row is dropped. Unused (too-short) waste bars are untouched. The next run/file therefore opens with the rack as it really stands. Fires once, at the commit point (re-planning beforehand doesn't touch inventory; re-planning is gated behind RELOAD anyway).

## CSV export (on BEGIN PRODUCTION)
Writes the **same reordered CSV to two destinations**:

| Copy | Filename | Where |
|------|----------|-------|
| Production | `<source> - production.csv` | **Source folder** (the loaded folder) |
| Printer/sticker | `Smart_Hangers_YYYY-MM-DD_HH-MM.csv` | **Printer output folder** (Documents) |

The timestamp is local time at write, from `new Date()`. `:` is illegal in filenames, so it's `HH-MM` (e.g. `Smart_Hangers_2026-06-06_15-27.csv`). Minute resolution — same-minute reruns overwrite.

### Format (both copies, identical content)
- Preserve the **UTF-8 BOM**, **CRLF**, any **title row**, and **header** verbatim — round-trippable.
- **Data rows = the original rows, reordered** into cut order (per bar), with one transform applied:
  - **Filler slots blanked.** Any slot with `D===1` has its `D`/`X`/`Y`/`ThreadLength` cells emptied (write-only filter — read path and Revit untouched). Keeps printed stickers clean. Blank still purges on re-import.
- After each bar's pieces, **one leftover row**: offcut length in the **`IronLength`** column, **`Comments` set to `Waste`**, every other column blank. Bars used to 0 leftover get no row.
- Unplaceable pieces keep their original rows, appended at the end (also filler-blanked).

> Leftover rows have a blank `Family and Type`, so re-importing skips them (read-only offcuts) — intended. The `Waste` comment is for the sticker, not for re-processing.

### Where it's written
- **File System Access (Chrome, desktop):** written silently into each folder via its directory handle (read-write granted at folder-pick). A confirmation banner lists both destinations.
- **Fallback (iPad/Safari, or no folder access):** both copies are browser **downloads** (the web can't target a specific OS folder). Two downloads fire back-to-back — Safari may show an "allow multiple downloads" prompt once.

## File I/O notes
- Loading uses `showDirectoryPicker({ mode:"readwrite", id:"smh-dir", startIn:"documents" })`; the printer picker uses the same options with `id:"smh-printer"`. The separate `id`s give each its own remembered location — sharing one would make the printer dialog open at the source folder.
- `startIn` only sets the dialog's *opening* location; it can't grant silent access to a well-known folder. The pick **is** the grant, and it's one-time per session (then writes are silent).
- There's **no way to get a file's parent directory from a file handle**, which is why loading picks the *folder* (not a file) — that's what lets us write outputs next to the source.
- Neither directory handle is persisted across a full browser restart (would need IndexedDB + a re-permission gesture). Operator re-picks both next day (dialogs reopen at the remembered/Documents locations). Build progress still restores from `localStorage`.
