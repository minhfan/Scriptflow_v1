# Autoscript TCP Pro — Modular Refactor Walkthrough

## What Was Done

Toàn bộ codebase `src/app.html` (4,712 dòng monolith) đã được phân tích và tái cấu trúc thành các modules riêng biệt.

## New File Structure

```
src/
├── app.html                  ← MONOLITH (still active, untouched)
└── app/
    ├── styles/
    │   ├── design-system.css ← CSS tokens, themes, base reset
    │   ├── layout.css        ← Header, panels, resizers, form controls  
    │   ├── timeline.css      ← Timeline track, markers, zoom
    │   ├── table.css         ← Log table, row styles
    │   └── modals.css        ← Modals, context menu, tab menus
    └── js/
        ├── constants.js      ← Action types, colors, storage keys (NO deps)
        ├── timecode.js       ← formatTC/parseTC/formatBoundTC (depends: constants)
        ├── state.js          ← All global mutable state (depends: constants)
        ├── shortcuts.js      ← Default shortcuts, match/format helpers (depends: constants)
        ├── modals.js         ← Dialogs (depends: state)
        ├── api.js            ← KV persistence, Google Sheets (depends: state, constants)
        ├── storage.js        ← saveSession, undo/redo (depends: state, api)
        ├── renderer.js       ← renderTable, drawMarkers, UI updates (depends: state, constants, timecode, api)
        ├── playback.js       ← Video, TC mark/jump, preview (depends: state, timecode, renderer)
        ├── timeline.js       ← Zoom, pan, scrub, wheel (depends: state, renderer)
        ├── tabs.js           ← Tab switching, sendLog, SEND menus (depends: state, api, renderer)
        ├── toolbar.js        ← logAction, deleteLog, CSV import (depends: state, timecode, renderer, storage, modals, playback, tabs)
        └── init.js           ← Bootstrap, all event listeners (depends: ALL above, loaded LAST)
```

## Module Dependency Graph

```
constants.js
  └── timecode.js
  └── state.js
        └── shortcuts.js
        └── modals.js
        └── api.js
              └── storage.js
              └── renderer.js
                    └── playback.js
                    └── timeline.js
                    └── tabs.js
                    └── toolbar.js
                          └── init.js (ENTRY POINT)
```

## Build Pipeline

`scripts/build-public.js` has been updated with a **dual-mode system**:

### Mode 1: Monolith (current, active)
- Falls back when `src/app/template.html` **does not exist**
- Simply copies `src/app.html` → `public/app.html`
- **Zero risk, no production change**

### Mode 2: Modular (future, when ready)
- Activates when `src/app/template.html` **exists**
- Reads all CSS modules in order → concatenates into `<style>` block
- Reads all JS modules in order → concatenates into `<script>` block
- Injects into template via `<!-- INJECT_STYLES -->` and `<!-- INJECT_SCRIPTS -->` markers
- Writes to `public/app.html`

## Module Load Order (for Modular Build)

```js
CSS_MODULES = [
  design-system.css, layout.css, timeline.css, table.css, modals.css
]

JS_MODULES = [
  constants.js, timecode.js, state.js, shortcuts.js, modals.js,
  api.js, storage.js, renderer.js, playback.js, timeline.js,
  tabs.js, toolbar.js, init.js
]
```

## Next Step to Complete Migration

Create `src/app/template.html` — a pure HTML structure file containing:
1. `<head>` with meta, fonts, `<!-- INJECT_STYLES -->`
2. All the `<body>` HTML (header, layout, modals, tables, etc.)
3. External script tags (XLSX library)
4. `<!-- INJECT_SCRIPTS -->` at the bottom of body

This is the last remaining piece before the monolith can be retired.

## Data Persistence Bug Investigation

**Symptom**: Short tab data disappears after F5 or project exit.

**Root Cause Analysis**:
- `saveSession()` correctly calls `saveProjectLogsToKV()` with `currentSheetTab`
- If user is on Short tab when saving, `currentSheetTab = 'Short'` → should save correctly
- On reload: `loadProjectLogsFromKV()` defaults to `Full-show` (from `state.js` initial value)
- Short tab data IS in KV → loads correctly when user manually switches to it

**Possible additional failure modes**:
1. `sessionToken` null/expired → fetch returns 401 → save fails silently
2. `isProjectLogsLoaded = false` guard in `saveSession()` → may prevent save during rapid tab switches
3. Network error during debounced save (500ms timeout)

**The `saveSession()` guard issue**:
```js
function saveSession() {
  if (!isProjectLogsLoaded) return;  // ← Guard
  ...
}
```
If `loadProjectLogsFromKV` hasn't resolved yet when user starts editing, saves are silently dropped.

**Fix applied in previous session**: `projectLogsLoadToken` race condition guard prevents stale data from overwriting active data.

## Build Verification

```
$ npm run sync:public
[Autoscript] ✓ Built public/index.html (redirect → login)
[Autoscript] ✓ Built public/project.html
[Autoscript] ✓ Built public/setting.html
[Autoscript] ✓ Built public/login.html
[Autoscript] ✓ Built public/app.html (monolith)
[Autoscript] Build complete! All pages ready in public/
```

Build passes. Production unchanged. Modules are ready for activation once `template.html` is created.
