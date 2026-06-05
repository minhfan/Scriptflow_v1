// ============================================================
//  AUTOSCRIPT TCP Pro — shortcuts.js
//  Default shortcut definitions, match helper, display helpers.
//  Depends on: constants.js (actionList)
// ============================================================

// ── Default Shortcut Map ─────────────────────────────────────
const defaultShortcuts = {
    action    : { key:'A',     shift:false, ctrl:false, alt:false, label:'Select TAG'           },
    script    : { key:'S',     shift:false, ctrl:false, alt:false, label:'Select SCRIPT'           },
    note      : { key:'N',     shift:false, ctrl:false, alt:false, label:'Select NOTE'             },
    video     : { key:'V',     shift:false, ctrl:false, alt:false, label:'Upload Video'            },
    tcin      : { key:'I',     shift:false, ctrl:false, alt:false, label:'Mark TC IN'              },
    tcout     : { key:'O',     shift:false, ctrl:false, alt:false, label:'Mark TC OUT'             },
    tcswap    : { key:'E',     shift:false, ctrl:false, alt:false, label:'Mark TC SWAP'            },
    jumpin    : { key:'Q',     shift:false, ctrl:false, alt:false, label:'Seek to IN'              },
    jumpout   : { key:'W',     shift:false, ctrl:false, alt:false, label:'Seek to OUT'             },
    play      : { key:' ',     shift:false, ctrl:false, alt:false, label:'Play/Pause'              },
    save      : { key:'Enter', shift:true,  ctrl:false, alt:false, label:'Import (Shift+Enter)'    },
    prev      : { key:'[',     shift:false, ctrl:false, alt:false, label:'Prev Marker'             },
    next      : { key:']',     shift:false, ctrl:false, alt:false, label:'Next Marker'             },
    slow      : { key:',',     shift:false, ctrl:false, alt:false, label:'Speed -0.25x'            },
    fast      : { key:'.',     shift:false, ctrl:false, alt:false, label:'Speed +0.25x'            },
    previewCut: { key:'P',     shift:false, ctrl:false, alt:false, label:'Toggle Preview Cut'      },
    fullscreen: { key:'F',     shift:false, ctrl:false, alt:false, label:'Toggle Fullscreen'       },
    zoom1x    : { key:'Z',     shift:false, ctrl:false, alt:false, label:'Fit Timeline (Zoom 1x)'  },
    zoomOut   : { key:'-',     shift:false, ctrl:false, alt:false, label:'Zoom Out 5x'             },
    zoomIn    : { key:'=',     shift:false, ctrl:false, alt:false, label:'Zoom In 5x'              }
};

// ── Load Saved Shortcuts (merge with defaults) ────────────────
let shortcuts = { ...defaultShortcuts };
try {
    const saved = JSON.parse(localStorage.getItem(SHORTCUT_STORAGE_KEY));
    if (saved && typeof saved === 'object') {
        for (const key of Object.keys(defaultShortcuts)) {
            if (saved[key] && typeof saved[key].key === 'string') {
                shortcuts[key] = { ...defaultShortcuts[key], ...saved[key] };
            }
        }
    }
} catch (e) {
    localStorage.removeItem(SHORTCUT_STORAGE_KEY);
}

// ── Helpers ───────────────────────────────────────────────────
function formatShortcutDisplay(sc) {
    if (!sc) return '?';
    const parts = [];
    if (sc.ctrl)  parts.push('Ctrl');
    if (sc.alt)   parts.push('Alt');
    if (sc.shift) parts.push('Shift');
    parts.push(sc.key === ' ' ? 'Space' : sc.key.toUpperCase());
    return parts.join('+');
}

function matchShortcut(e, name) {
    const sc = shortcuts[name];
    if (!sc) return false;
    const keyMatch = sc.key === ' ' ? e.key === ' ' : e.key.toUpperCase() === sc.key.toUpperCase();
    return keyMatch
        && e.shiftKey         === sc.shift
        && (e.ctrlKey || e.metaKey) === sc.ctrl
        && e.altKey           === sc.alt;
}
