# Data Model & CSV

## Source
CSV exported from Revit. One row per smart-hanger. Current sample in the project:
`Smart_Hangers_…M8 Takjärn…300mm_M10Gängstång.csv` (6 hangers, HA1–HA6).

## Hanger anatomy
- **Base bar**: horizontal rail, typically <2m long.
- **Threaded rods**: up to 20 per bar, each at an absolute position along the bar, with its own cut length (10mm dia).
- **Pipe clamps**: one per rod, sits on top of the rod (rod through centre, circle balances on top), varies 15–200+mm diameter.

## CSV structure
1. **Title row** — optional (the current export has none; older ones had `Smart_Hangers cc41` + trailing commas). The parser locates the header by name, so a title row is tolerated but not required.
2. **Header row** — identified by the presence of the `IronLength` column (do not assume a fixed row index).
3. **Data rows** — one per hanger.

The file carries a UTF-8 BOM and CRLF line endings (both preserved on export — see `05`).

> **Quoted fields.** Rows are split quote-aware (RFC 4180, `splitCSVLine`), so a `"…"` field is kept whole — but the widget then **refuses the file if any cell still contains a comma or a quote** (load guard 3 below). Exports must be comma-free: the Revit export now writes semicolons in text fields. Line breaks inside a field are **not** supported (rows are split on line breaks first).

### Columns (46 in the current export)
- `Family and Type` — hanger family/type string. A blank value here marks a non-data row (skip it).
- `IronLength` — base bar length, mm.
- Up to 20 clamp slots (`MAX_SLOTS`; older 10-slot exports still load — absent columns read as empty), each three columns: **`SH_n_D`, `SH_n_X`, `SH_n_Y`**.
  - **`D` = clamp diameter (mm)**
  - **`X` = position on bar (absolute, mm from the left end)**
  - **`Y` = pipe CENTERLINE height (mm)** — *not consumed by either app*; it is the design elevation, printed on stickers for manual control only.
- `Comments`, `Mark`, `MC Object Variable 4`, `MC Object Variable 3`. **Hanger ID = `Mark` → `row N`**. `Mark` holds the HA-n.n label (never whitespace); `Comments` holds the free-text bar notes (semicolons, no commas). Exports with the old layout (ID in `Comments`, notes in `Mark`) are refused by load guard 4.
- One **`SH_n_ThreadLength`** column per slot (mm) — **the family-computed rod CUT length** for each slot. This is what the operator cuts and what the widget shows on INSERT ROD.
  - **Blank `ThreadLength` on a slot that has a `D`/`X` = a rod-mark position** (`markOnly` after cleanup): the operator pen-marks it with the rod-marker, **no rod is cut and no clamp is fitted**. Used for rail joints / bolt crossings. The widget emits a single ROD MARK task for it; the BOM counts it under "Rod marks", not under rod mm or clamps.
  - ⚠ **Conflict with load guard 2** (below): a slot with `D≠1` and blank `ThreadLength` is exactly what the 2026-10-28 damaged file looked like, so the widget now refuses it. Rod marks are unloadable until this is resolved (open item in `CLAUDE.md`).

Columns are mapped **by name**, so reordering and renamed `MC Object Variable *` columns are tolerated. (Older exports used `MC Object Variable 2`; irrelevant — never read.)

### Rod length: ThreadLength, not Y
`Y` is the pipe centerline; the true rod is shorter by the clamp's centerline-to-rod offset, which carries a non-geometric constant (≈10.5mm on top of the radius) that varies by clamp. The Revit family computes this and exports it as `SH_n_ThreadLength`, so the apps **read ThreadLength directly and never derive from Y**. Spot check: `ThreadLength ≈ Y − (D/2 + ~10.5)`.

> **Old exports (no `SH_n_ThreadLength`) are refused.** The widget hard-errors on load — the cut length isn't derivable, so there is no silent fallback. Re-export from Revit.

### Load guards (widget only)

Added after the 2026-10-28 Simhall file: an earlier build split rows on every comma, the `Mark` notes held commas, so `SH_n_ThreadLength` cells shifted right and the writer trimmed each row back to header width. The current build loaded that file, saw real clamps with blank `ThreadLength`, treated them as rod marks and **silently dropped 55 clamps on 31 hangers** — every shown value was correct, only missing. A column count alone would not have caught it (every row still had 86 cells).

`parseCSV` now validates **every data row** (a row whose `Family and Type` is non-empty) after the header is found and before any hanger is built. The first failure returns `{ hangers: [], error }` and nothing is loaded — never a partial file. `id` = `Comments`, else `Mark`, else `row n`.

1. **Column count** — exactly as many cells as the header after `splitCSVLine`. `Row n (id or "no id"): k columns, header has h. File is damaged, re-export from Revit.`
2. **Slot consistency** — for every slot with all three columns: if `SH_n_D` parses as a number other than 1, `SH_n_X` and `SH_n_ThreadLength` must both parse as numbers. `Row n (id): slot n has D=d but no X|ThreadLength. File is damaged, re-export from Revit.` This is the check that catches the 2026-10-28 file (first hit HA-2.1 slot 4).
3. **No commas / quotes inside cells** — after splitting, any cell containing `,` or `"` refuses the file. `Row n (id): text contains a comma or quote. Exports must be comma-free, re-export from Revit.`

4. **Column layout** — `Mark` must hold the ID: a row with an empty `Mark` but a filled `Comments`, or whitespace inside `Mark`, is the old layout (ID in `Comments`, notes in `Mark`). `Row n: Comments holds "HA-1.1" and Mark is empty. The hanger ID must be in Mark — old column layout, re-export from Revit with the updated exporter.` (or `Mark holds text ("…")`). Both 28 Oct files trip this on row 1.

Checks run per row in the order 1, 4, 2, 3, so an old-layout file reports the layout, and a damaged new-layout row reports the slot even if its notes also hold commas. The error shows in the load screen's existing error slot. The BOM app's `parseCSV` copy carries guard 4 only.

### Hanger ID
ID resolution is **`Mark` → `row N`** in both apps; `Comments` is never an ID. The 28 Oct 2026 exports had it the other way round (label in `Comments`, notes in `Mark`); the KJTools exporter was changed on 31 Oct 2026 to export both columns as-is, and both apps now refuse the old layout (guard 4). The sticker CSV the widget writes swaps them back, because the Brother label template reads the ID from `Comments` (see `05`).
> Both apps resolve the ID this way, read `ThreadLength` for rod length, and refuse exports without it. (The BOM app was patched to match the widget; its `parseCSV` is still a separate copy — sync by hand.)

## Preprocessing (per row)
1. **Purge filler clamps.** Revit pads unused slots with a sentinel where **`D = 1`** (a 1mm clamp is physically impossible). `X`/`Y` on filler slots are not fixed (`Y` is typically 30, `X` varies per row, `ThreadLength` is typically 19) — so the **only reliable rule is drop any slot where `D === 1`**. Filler can appear anywhere in the row (including the first slot), so purge before sorting. A blanked filler (empty `D`, see `05`) also drops — empty parses as NaN and is skipped.
2. **Sort** surviving clamps by position (`X`) ascending. Guarantees left-to-right order for marking and assembly.

`parseCSV` + `cleanHanger` perform this and are the shared core (see `04`).

## Marks vs deltas
The operator widget marks **absolute distances from the left end** (the clamp `X` values), one per screen. Feeds and deltas are gone — marking is absolute.

## Visual representation (to-scale, side view)
- Base bar: horizontal rectangle along the bottom, 30mm thick.
- Rod: thin vertical rectangle (10mm) rising from the top of the bar at its position, drawn to **`ThreadLength`** (the cut length).
- Clamp: circle centred on the rod's vertical axis, bottom edge touching the rod tip (centre = clamp radius above tip).
- The clamp centre therefore sits ≈10.5mm below the true centerline (`Y`), which is *not* drawn — invisible at minimap scale, accepted.

## Export CSV (operator widget)
On Begin Production the widget writes one sticker CSV into the loaded folder. Format and rules are in `05-planning-and-export.md`. In short: BOM + title + header preserved, original rows reordered into cut order with **filler slots blanked** and **`Comments`/`Mark` swapped** (the Brother label template reads the ID from `Comments`), plus a `Waste`-labelled leftover row (offcut length in `IronLength`, rest blank) after each bar.
