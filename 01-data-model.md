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

> **No commas inside fields.** The parser splits on raw commas (no quote handling) — agreed constraint. Revit `Family and Type` etc. must stay comma-free.

### Columns (46 in the current export)
- `Family and Type` — hanger family/type string. A blank value here marks a non-data row (skip it).
- `IronLength` — base bar length, mm.
- Up to 20 clamp slots (`MAX_SLOTS`; older 10-slot exports still load — absent columns read as empty), each three columns: **`SH_n_D`, `SH_n_X`, `SH_n_Y`**.
  - **`D` = clamp diameter (mm)**
  - **`X` = position on bar (absolute, mm from the left end)**
  - **`Y` = pipe CENTERLINE height (mm)** — *not consumed by either app*; it is the design elevation, printed on stickers for manual control only.
- `Comments`, `Mark`, `MC Object Variable 4`, `MC Object Variable 3`.
- One **`SH_n_ThreadLength`** column per slot (mm) — **the family-computed rod CUT length** for each slot. This is what the operator cuts and what the widget shows on INSERT ROD.

Columns are mapped **by name**, so reordering and renamed `MC Object Variable *` columns are tolerated. (Older exports used `MC Object Variable 2`; irrelevant — never read.)

### Rod length: ThreadLength, not Y
`Y` is the pipe centerline; the true rod is shorter by the clamp's centerline-to-rod offset, which carries a non-geometric constant (≈10.5mm on top of the radius) that varies by clamp. The Revit family computes this and exports it as `SH_n_ThreadLength`, so the apps **read ThreadLength directly and never derive from Y**. Spot check: `ThreadLength ≈ Y − (D/2 + ~10.5)`.

> **Old exports (no `SH_n_ThreadLength`) are refused.** The widget hard-errors on load — the cut length isn't derivable, so there is no silent fallback. Re-export from Revit.

### Hanger ID — quirk
ID resolution is **`Mark` → `Comments` → `row N`**.
In these exports the `HA…` labels live in **`Comments`**; **`Mark` is empty**.
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
On Begin Production the widget writes a reordered CSV (two copies, two folders). Format and rules are in `05-planning-and-export.md`. In short: BOM + title + header preserved, original rows reordered into cut order with **filler slots blanked**, plus a `Waste`-labelled leftover row (offcut length in `IronLength`, rest blank) after each bar.
