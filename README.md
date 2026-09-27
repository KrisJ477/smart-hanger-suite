# Smart-Hanger Suite

Tools for fabricating smart-hangers (base bar + threaded rods + pipe clamps) from Revit CSV exports.

- **`apps/bom-app.html`** — bill of materials for purchasing/planning.
- **`apps/operator-widget.html`** — shop-floor operator app: plans bar cutting, exports the reordered CSV, then guides assembly one task at a time. May later drive a LinuxCNC saw.

Both are standalone HTML (React 18 + Babel via CDN, no build step). Open in Chrome — desktop Chrome is needed for folder read/write (File System Access API).

Specs live in `docs/`; project conventions for Claude Code are in `CLAUDE.md`. A sample export is in `samples/`.
