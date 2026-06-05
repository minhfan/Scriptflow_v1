// ============================================================
//  AUTOSCRIPT TCP Pro — state.js
//  All global mutable state declarations.
//  No DOM access. No function calls.
//  Depends on: constants.js
// ============================================================

// ── Playback State ───────────────────────────────────────────
let playbackSpeed    = 1.0;
let reverseInterval  = null;

// ── Active TC Points ─────────────────────────────────────────
let activeInSec      = null;
let activeOutSec     = null;
let activeSwapSec    = null;
let activeThumbnail  = null;

// ── Edit Mode & View Mode ──────────────────────────────────────
let editingRowIndex  = null;
let menuTargetIndex  = null;
let isStoryboardView = false;

// ── Preview Cut ──────────────────────────────────────────────
let isPreviewCut     = false;
let previewState     = { active: false, logIndex: -1, phase: 0, restorePreviewCut: false };
let originalPreviewCutState = null;

// ── Resizing ─────────────────────────────────────────────────
let isResizingV      = false;
let isResizingH1     = false;
let isResizingH2     = false;

// ── Float Panel Drag ─────────────────────────────────────────
let isDraggingFloat  = false;
let floatOffsetX, floatOffsetY;

// ── Speed Drag ───────────────────────────────────────────────
let isDraggingSpeed  = false;
let speedStartX = 0, speedStartVal = 1.0, speedDidDrag = false;

// ── Undo / Redo History ──────────────────────────────────────
let logHistory  = [];
let redoHistory = [];

// ── Action Types & Colors (Dynamic) ────────────────────────────
const defaultActionList = ['DELETE','SWAP','POP-UP','QUESTION','QUOTE','NOTE','OTHERS'];
const defaultActionColors = {
    'DELETE' : { bg:'#b91c1c', color:'#ffffff' },
    'SWAP'    : { bg:'#ea580c', color:'#ffffff' },
    'POP-UP'  : { bg:'#166534', color:'#ffffff' },
    'QUESTION': { bg:'#1d4ed8', color:'#ffffff' },
    'QUOTE'   : { bg:'#a855f7', color:'#ffffff' },
    'NOTE'    : { bg:'#3f3f46', color:'#f8fafc' },
    'OTHERS'  : { bg:'#1e293b', color:'#e2e8f0' }
};

let actionPresets = null; // Map of id -> { name, actionList, actionColors }
try {
    const stored = localStorage.getItem('autoscript_action_presets');
    if (stored) actionPresets = JSON.parse(stored);
} catch (e) {
    console.warn("Failed to load action presets", e);
}

if (!actionPresets) {
    actionPresets = {
        'default': { name: 'Standard', actionList: [...defaultActionList], actionColors: { ...defaultActionColors }, isDefault: true },
        'podcast': { 
            name: 'Podcast', 
            isDefault: true,
            actionList: ['HOST', 'GUEST', 'LAUGH', 'SPONSOR', 'B-ROLL', 'NOTE', 'OTHERS'],
            actionColors: {
                'HOST': { bg: '#2563eb', color: '#ffffff' },
                'GUEST': { bg: '#16a34a', color: '#ffffff' },
                'LAUGH': { bg: '#f59e0b', color: '#ffffff' },
                'SPONSOR': { bg: '#9333ea', color: '#ffffff' },
                'B-ROLL': { bg: '#0891b2', color: '#ffffff' },
                'NOTE': { bg: '#3f3f46', color: '#f8fafc' },
                'OTHERS': { bg: '#1e293b', color: '#e2e8f0' }
            }
        },
        'vlog': {
            name: 'Vlog / Travel',
            isDefault: true,
            actionList: ['POV', 'DRONE', 'FOOD', 'TIMELAPSE', 'B-ROLL', 'NOTE', 'OTHERS'],
            actionColors: {
                'POV': { bg: '#dc2626', color: '#ffffff' },
                'DRONE': { bg: '#0284c7', color: '#ffffff' },
                'FOOD': { bg: '#ea580c', color: '#ffffff' },
                'TIMELAPSE': { bg: '#c026d3', color: '#ffffff' },
                'B-ROLL': { bg: '#16a34a', color: '#ffffff' },
                'NOTE': { bg: '#3f3f46', color: '#f8fafc' },
                'OTHERS': { bg: '#1e293b', color: '#e2e8f0' }
            }
        }
    };
    localStorage.setItem('autoscript_action_presets', JSON.stringify(actionPresets));
} else {
    // Migration: ensure built-in presets have isDefault
    if (actionPresets['default']) actionPresets['default'].isDefault = true;
    if (actionPresets['podcast']) actionPresets['podcast'].isDefault = true;
    if (actionPresets['vlog']) actionPresets['vlog'].isDefault = true;
    // Migration: fix Standard name if it still has (Default)
    if (actionPresets['default'] && actionPresets['default'].name.includes('(Default)')) {
        actionPresets['default'].name = 'Standard';
    }
}

let currentPresetId = localStorage.getItem('autoscript_current_preset_id') || 'default';
if (!actionPresets[currentPresetId]) currentPresetId = 'default';

let actionList = [...actionPresets[currentPresetId].actionList];
let actionColors = { ...actionPresets[currentPresetId].actionColors };

function loadActionPreset(presetId) {
    if (actionPresets[presetId]) {
        currentPresetId = presetId;
        const preset = actionPresets[presetId];
        // Support both old 'actions/colors' and new 'actionList/actionColors' schema
        actionList = [...(preset.actionList || preset.actions || defaultActionList)];
        actionColors = { ...(preset.actionColors || preset.colors || defaultActionColors) };
        localStorage.setItem('autoscript_current_preset_id', presetId);
        selectedAction = actionList[0];
    }
}

// ── Update Current Preset (From UI Drag/Drop or Add) ─────────
function updateCurrentPreset(newList, newColors) {
    let preset = actionPresets[currentPresetId];
    
    // Auto-clone if modifying a default preset
    if (!preset || preset.isDefault === true || preset.isDefault === undefined) {
        // Find if it has a proper name, else default
        const oldName = preset ? preset.name : 'Custom';
        // Some older defaults might not have isDefault set explicitly, check id
        if (currentPresetId === 'default' || currentPresetId === 'podcast' || currentPresetId === 'vlog') {
            const newId = 'custom_' + Date.now();
            actionPresets[newId] = {
                id: newId,
                name: oldName.replace(' (Custom)', '') + ' (Custom)',
                isDefault: false,
                actionList: [...newList],
                actionColors: { ...newColors }
            };
            currentPresetId = newId;
            preset = actionPresets[currentPresetId];
        } else {
            // It's a custom preset already
            preset.actionList = [...newList];
            preset.actionColors = { ...newColors };
            preset.actions = [...newList]; // maintain backward compat for settings UI
            preset.colors = { ...newColors };
        }
    } else {
        preset.actionList = [...newList];
        preset.actionColors = { ...newColors };
        preset.actions = [...newList]; // maintain backward compat
        preset.colors = { ...newColors };
    }
    
    actionList = [...newList];
    actionColors = { ...newColors };
    
    localStorage.setItem('autoscript_action_presets', JSON.stringify(actionPresets));
    localStorage.setItem('autoscript_current_preset_id', currentPresetId);
    
    // Re-render custom dropdown
    if (window.renderTagPresetMenu) {
        window.renderTagPresetMenu();
    }
}

// ── Action Selection ─────────────────────────────────────────
let selectedAction = actionList[0];

// ── Tab / Sheet State ────────────────────────────────────────
let currentSheetTab      = 'Full-show';
let availableSheetTabs   = ['Full-show'];

// ── Project Identity ─────────────────────────────────────────
let currentSpreadsheetId   = localStorage.getItem('autoscript_current_spreadsheet_id') || '';
let currentSpreadsheetUrl  = localStorage.getItem('autoscript_current_spreadsheet_url') || '';
let currentSpreadsheetName = localStorage.getItem('autoscript_current_spreadsheet_name') || '';
let currentProjectVideoMeta = null;
let pendingVideoMeta = null;

// ── Session Auth ─────────────────────────────────────────────
let googleClientId = localStorage.getItem('autoscript_google_client_id') || '';
const sessionToken = localStorage.getItem('autoscript_session_token');
let googleSheetsUrl = localStorage.getItem('autoscript_google_sheets_url') || '';

// ── Shortcut State ───────────────────────────────────────────
let listeningAction = null;

// ── Table Filters ────────────────────────────────────────────
let searchQuery = '';
let filterQuery = 'ALL';

// ── Clipboard (last imported log → re-send to Short) ─────────
let clipboardLogData = null;

// ── TC Auto-Select (click row → populate toolbar) ────────────
let tcAutoSelected = false;
let tcJumpWait     = false;

// ── Persistence State ────────────────────────────────────────
let logs                 = [];
let projectLogsSaveTimer = null;
let isProjectLogsLoaded  = false;
let projectLogsLoadToken = 0;
let isLogsDirty          = false;

// ── In-Memory Tab Cache (instant tab switching) ───────────────
const tabLogsCache = {};
