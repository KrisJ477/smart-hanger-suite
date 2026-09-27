# LinuxCNC Integration Architecture

> **Status: not yet started.** Forward-looking design. The widget is now standalone HTML (browser/tablet), which already fits the planned websocket-to-bridge model below. Verify any LinuxCNC specifics by searching before implementing — don't rely on memory.

## Target machine
Thomas 310 automatic saw, being converted with a new LinuxCNC-controlled X axis. Cuts base bars and threaded rods to length. Also requires spoofing of blade up/down cycles via digital I/O — a handful of inputs and a couple of outputs.

## Requirement
Widget must work in two modes:
- **Auto** — saw cuts to length, widget waits for cut-complete then advances.
- **Manual fallback** — saw offline or unavailable, widget displays the same number and waits for the operator to cut manually.

Numbers stay visible on screen in both modes. The widget is the source of truth; the saw is an optional accelerator. (This matches the current build, where every cut/length is shown regardless of saw status.)

## Chosen architecture: halui + bridge daemon
- **LinuxCNC + Axis** runs normally on the saw PC (NOT headless — operator needs Axis visible for jogging, alarms, diagnostics).
- **halui** loaded with a small set of `MDI_COMMAND` entries in the INI for cut macros.
- **Python bridge daemon** (HAL userspace component + socket server) runs alongside on the same PC. Owns the HAL pins; receives JSON commands from the widget over a socket.
- **Widget** runs in a browser or on a tablet, talks to the bridge via websocket. (The widget being standalone HTML keeps this clean — no LinuxCNC-environment coupling.)

## Why not other options
- **QtVCP**: tighter coupling but locks the widget into the LinuxCNC environment. Loses the standalone manual-fallback path and slows iteration.
- **linuxcncrsh**: official telnet API, but cannot run simultaneously with Axis. Veto'd — Axis must stay visible.
- **Python `linuxcnc` module directly from an external app**: mode/MDI conflicts with Axis reported by other users. halui is the designed-for-coexistence path.

## Status updates
LinuxCNC is poll-based, not push. The bridge polls HAL/status at ~20Hz (trivial on the same machine) and pushes websocket events to the widget on state change, so the widget feels event-driven.

Key values to monitor: `interp_state`, `task_mode`, `estop`, `homed`, custom pins for blade position + cut-complete, error strings.

## Critical safety note
"MDI command finished" ≠ "saw cycle complete." Cut-complete must come from a **physical sensor** confirming blade-up-and-clear before the widget unlocks NEXT.
