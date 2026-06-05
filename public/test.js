
    // Debug: catch and display any JS errors
    window.__jsErrors = [];
    window.onerror = function(msg, src, line, col) {
        window.__jsErrors.push(msg + ' @ ' + src + ':' + line);
        console.error('[AUTOSCRIPT ERROR]', msg, '@', src, ':', line);
    };
    


let FPS = 29.97;

function formatTC(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00:00:00";
    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds % 3600) / 60);
    const ss = Math.floor(seconds % 60);
    const fractional = seconds - Math.floor(seconds);
    let ff = Math.floor(fractional * FPS);
    if (ff >= FPS) ff = FPS - 1;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
}

function parseTC(tcStr) {
    if (!tcStr || typeof tcStr !== 'string') return 0;
    const p = tcStr.trim().split(':');
    if (p.length !== 4) return 0;
    const vals = p.map(Number);
    if (vals.some(isNaN)) return 0;
    return vals[0]*3600 + vals[1]*60 + vals[2] + vals[3]/FPS;
}

function formatBoundTC(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    
    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

// ============================================================
//  AUTOSCRIPT TCP — app.js  (complete, bug-free rewrite)
//  formatTC / parseTC come from timecode.js (loaded first)
// ============================================================

// ── 1. GLOBAL STATE (must be at the very top) ───────────────
let playbackSpeed    = 1.0;
let listeningAction  = null;
let activeInSec      = null;
let activeOutSec     = null;
let activeSwapSec    = null;
let isPreviewCut     = false;
let reverseInterval  = null;
let isResizingV      = false;
let isResizingH1     = false;
let isResizingH2     = false;
let isDraggingFloat  = false;
let floatOffsetX, floatOffsetY;
let isDraggingSpeed  = false;
let speedStartX = 0, speedStartVal = 1.0, speedDidDrag = false;
let logHistory  = [];
let redoHistory = [];
let previewState = { active: false, logIndex: -1, phase: 0, restorePreviewCut: false };
let originalPreviewCutState = null;
let editingRowIndex = null;
let menuTargetIndex = null;

const actionList = ['DELETE','SWAP','POP-UP','QUESTION','QUOTE','NOTE','OTHERS'];
const actionColors = {
    'DELETE' : { bg:'#b91c1c', color:'#ffffff' },
    'SWAP'    : { bg:'#ea580c', color:'#ffffff' },
    'POP-UP'  : { bg:'#166534', color:'#ffffff' },
    'QUESTION': { bg:'#1d4ed8', color:'#ffffff' },
    'QUOTE'   : { bg:'#a855f7', color:'#ffffff' },
    'NOTE'    : { bg:'#3f3f46', color:'#f8fafc' },
    'OTHERS'  : { bg:'#1e293b', color:'#e2e8f0' }
};
let selectedAction = actionList[0];
let googleSheetsUrl = localStorage.getItem('autoscript_google_sheets_url') || '';

let currentSpreadsheetId   = localStorage.getItem('autoscript_current_spreadsheet_id') || '';
let currentSpreadsheetUrl  = localStorage.getItem('autoscript_current_spreadsheet_url') || '';
let currentSpreadsheetName = localStorage.getItem('autoscript_current_spreadsheet_name') || '';

// ── Read spreadsheet info from URL query params (from /project page) ──
(function applyUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSheetId   = urlParams.get('sheetId');
    const urlSheetName = urlParams.get('sheetName');
    const urlSheetUrl  = urlParams.get('sheetUrl');
    if (urlSheetId) {
        currentSpreadsheetId   = urlSheetId;
        currentSpreadsheetUrl  = urlSheetUrl || `https://docs.google.com/spreadsheets/d/${urlSheetId}/edit`;
        currentSpreadsheetName = urlSheetName || 'Google Sheet';
        localStorage.setItem('autoscript_current_spreadsheet_id', currentSpreadsheetId);
        localStorage.setItem('autoscript_current_spreadsheet_url', currentSpreadsheetUrl);
        localStorage.setItem('autoscript_current_spreadsheet_name', currentSpreadsheetName);
    }
})();

function updateActiveSheetUI() {
    const linkEl = document.getElementById('activeSheetLink');
    const nameEl = document.getElementById('activeSheetName');
    const defaultTitle = document.getElementById('defaultScriptTitle');
    if (linkEl && nameEl) {
        if (currentSpreadsheetId && currentSpreadsheetUrl) {
            linkEl.href = currentSpreadsheetUrl;
            nameEl.innerText = currentSpreadsheetName || 'Google Sheet';
            linkEl.style.display = 'inline-flex';
            if (defaultTitle) defaultTitle.style.display = 'none';
        } else {
            linkEl.style.display = 'none';
            if (defaultTitle) defaultTitle.style.display = 'inline';
        }
    }
}

let googleClientId = localStorage.getItem('autoscript_google_client_id') || '';
let googleAccessToken = localStorage.getItem('autoscript_google_access_token') || '';
let googleTokenExpiry = Number(localStorage.getItem('autoscript_google_token_expiry')) || 0;
let googleUserEmail = localStorage.getItem('autoscript_google_user_email') || '';
let tokenClient = null;

// Cấu hình ID Trang tính gốc làm mẫu (Template Spreadsheet ID)
const TEMPLATE_SPREADSHEET_ID = "1S6YxzKJE7X5vZRZduA36KDc_E00Cdkxp2mD3VXhwfmA";

function isTokenValid() {
    return googleAccessToken && googleTokenExpiry && (Date.now() < googleTokenExpiry - 60000);
}

function updateGoogleUI() {
    const statusEl = document.getElementById('googleUserStatus');
    const btnEl = document.getElementById('btnGoogleAuth');
    if (statusEl && btnEl) {
        if (isTokenValid()) {
            statusEl.innerText = `Đã đăng nhập: ${googleUserEmail || 'Google User'}`;
            statusEl.style.color = '#34d399';
            btnEl.innerText = 'Đăng xuất';
        } else {
            statusEl.innerText = 'Chưa đăng nhập Google';
            statusEl.style.color = 'var(--text-muted)';
            btnEl.innerText = 'Đăng nhập Google';
        }
    }
}

window.initGoogleOAuth = initGoogleOAuth;
function initGoogleOAuth() {
    if (!googleClientId || typeof google === 'undefined' || !google.accounts) return;
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
            callback: async (response) => {
                if (response.error !== undefined) {
                    console.error(response);
                    alert('Lỗi đăng nhập Google: ' + response.error);
                    return;
                }
                googleAccessToken = response.access_token;
                googleTokenExpiry = Date.now() + (response.expires_in * 1000);
                localStorage.setItem('autoscript_google_access_token', googleAccessToken);
                localStorage.setItem('autoscript_google_token_expiry', googleTokenExpiry);
                
                // Lấy Email người dùng
                try {
                    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
                    });
                    const userData = await userRes.json();
                    googleUserEmail = userData.email || '';
                    localStorage.setItem('autoscript_google_user_email', googleUserEmail);
                } catch(e) {
                    googleUserEmail = '';
                }
                
                updateGoogleUI();
                alert('Đăng nhập Google thành công!');
            }
        });
    } catch (err) {
        console.error('[GIS INIT ERROR]', err);
    }
}

function handleGoogleAuthClick() {
    if (!googleClientId) {
        alert('Vui lòng nhập Google OAuth Client ID trong Settings trước!');
        return;
    }
    if (isTokenValid()) {
        // Đăng xuất: xóa token
        googleAccessToken = '';
        googleTokenExpiry = 0;
        googleUserEmail = '';
        localStorage.removeItem('autoscript_google_access_token');
        localStorage.removeItem('autoscript_google_token_expiry');
        localStorage.removeItem('autoscript_google_user_email');
        updateGoogleUI();
        alert('Đã đăng xuất tài khoản Google.');
    } else {
        if (!tokenClient) {
            initGoogleOAuth();
        }
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            alert('Không thể khởi tạo Client đăng nhập Google. Kiểm tra lại Client ID!');
        }
    }
}

// ── 2. SESSION DATA ──────────────────────────────────────────
let logs = [];
try { logs = JSON.parse(localStorage.getItem('autoscript_tcp_v9')) || []; } catch(e) { logs = []; }

// ── 3. SHORTCUT DEFINITIONS ──────────────────────────────────
const defaultShortcuts = {
    action    : { key:'A', shift:false, ctrl:false, alt:false, label:'Select ACTION'         },
    script    : { key:'S', shift:false, ctrl:false, alt:false, label:'Select SCRIPT'         },
    note      : { key:'N', shift:false, ctrl:false, alt:false, label:'Select NOTE'           },
    video     : { key:'V', shift:false, ctrl:false, alt:false, label:'Upload Video'          },
    tcin      : { key:'I', shift:false, ctrl:false, alt:false, label:'Mark TC IN'            },
    tcout     : { key:'O', shift:false, ctrl:false, alt:false, label:'Mark TC OUT'           },
    tcswap    : { key:'E', shift:false, ctrl:false, alt:false, label:'Mark TC SWAP'          },
    jumpin    : { key:'Q', shift:false, ctrl:false, alt:false, label:'Seek to IN'            },
    jumpout   : { key:'W', shift:false, ctrl:false, alt:false, label:'Seek to OUT'           },
    play      : { key:' ', shift:false, ctrl:false, alt:false, label:'Play/Pause'            },
    save      : { key:'Enter', shift:true, ctrl:false, alt:false, label:'Import (Shift+Enter)' },
    prev      : { key:'[', shift:false, ctrl:false, alt:false, label:'Prev Marker'           },
    next      : { key:']', shift:false, ctrl:false, alt:false, label:'Next Marker'           },
    slow      : { key:',', shift:false, ctrl:false, alt:false, label:'Speed -0.25x'          },
    fast      : { key:'.', shift:false, ctrl:false, alt:false, label:'Speed +0.25x'          },
    previewCut: { key:'P', shift:false, ctrl:false, alt:false, label:'Toggle Preview Cut'    },
    fullscreen: { key:'F', shift:false, ctrl:false, alt:false, label:'Toggle Fullscreen'     },
    zoom1x    : { key:'Z', shift:false, ctrl:false, alt:false, label:'Fit Timeline (Zoom 1x)' },
    zoomOut   : { key:'-', shift:false, ctrl:false, alt:false, label:'Zoom Out 5x'           },
    zoomIn    : { key:'=', shift:false, ctrl:false, alt:false, label:'Zoom In 5x'            }
};

let shortcuts = { ...defaultShortcuts };
try {
    const saved = JSON.parse(localStorage.getItem('autoscript_shortcuts'));
    if (saved && typeof saved === 'object') {
        for (const key of Object.keys(defaultShortcuts)) {
            if (saved[key] && typeof saved[key].key === 'string') {
                shortcuts[key] = { ...defaultShortcuts[key], ...saved[key] };
            }
        }
    }
} catch(e) {
    localStorage.removeItem('autoscript_shortcuts');
}

// ── 4. DOM REFERENCES ────────────────────────────────────────
const mainContainer  = document.getElementById('mainContainer');
const leftCol        = document.getElementById('leftCol');
const rightCol       = document.getElementById('tablePanel');
const resizerV       = document.getElementById('resizerV');
const resizerH1      = document.getElementById('resizerH1');
const resizerH2      = document.getElementById('resizerH2');
const videoSection   = document.getElementById('videoSection');
const formSection    = document.getElementById('formSection');
const floatPanel     = document.getElementById('floatHelpPanel');
const floatHeader    = document.getElementById('floatHelpHeader');
const video          = document.getElementById('videoPlayer');
const upload         = document.getElementById('videoUpload');
const bigTc          = document.getElementById('bigTimecode');
const valTcIn        = document.getElementById('valTcIn');
const valTcOut       = document.getElementById('valTcOut');
const valTcSwap      = document.getElementById('valTcSwap');
const boxIn          = document.getElementById('boxIn');
const boxOut         = document.getElementById('boxOut');
const boxSwap        = document.getElementById('boxSwap');
const activeRange    = document.getElementById('activeRange');
const speedDisplay   = document.getElementById('speedDisplay');
const speedMenu      = document.getElementById('speedMenu');
const mSettings      = document.getElementById('settingsModal');
const themeSelect    = document.getElementById('themeSelect');
const btnPreviewCut  = document.getElementById('btnPreviewCut');
const btnPlayVideo   = document.getElementById('btnPlayVideo');
const btnPlayReverse = document.getElementById('btnPlayReverse');
const timelineWrapper  = document.getElementById('customTimeline');
const timelineProgress = document.getElementById('timelineProgress');
const hoverTooltip   = document.getElementById('hoverTooltip');
const actionButtons  = Array.from(document.querySelectorAll('#actionButtonGroup .action-button'));
const btnToolbarImport = document.getElementById('btnToolbarImport');
const btnSyncSheets    = document.getElementById('btnSyncSheets');

// ── 5. UTILITY FUNCTIONS ─────────────────────────────────────
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

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
    return keyMatch && e.shiftKey === sc.shift
        && (e.ctrlKey || e.metaKey) === sc.ctrl
        && e.altKey === sc.alt;
}

// ── 6. UNDO / REDO ───────────────────────────────────────────
function saveState(clearRedo = true) {
    logHistory.push(JSON.parse(JSON.stringify(logs)));
    if (logHistory.length > 50) logHistory.shift();
    if (clearRedo) redoHistory = [];
}
function undo() {
    if (logHistory.length > 0) {
        redoHistory.push(JSON.parse(JSON.stringify(logs)));
        logs = logHistory.pop();
        renderTable(); drawMarkers(); saveSession();
    }
}
function redo() {
    if (redoHistory.length > 0) {
        logHistory.push(JSON.parse(JSON.stringify(logs)));
        logs = redoHistory.pop();
        renderTable(); drawMarkers(); saveSession();
    }
}

// ── 7. SESSION SAVE ──────────────────────────────────────────
function saveSession() {
    localStorage.setItem('autoscript_tcp_v9', JSON.stringify(logs));
    const status = document.getElementById('saveStatus');
    if (status) { status.innerText = 'Saving…'; setTimeout(() => { status.innerText = 'Saved'; }, 500); }
}

// ── 8. RENDER SETTINGS (Shortcuts panel) ─────────────────────
function renderSettings() {
    const sGrid = document.getElementById('settingsGrid');
    const hGrid = document.getElementById('helpGrid');
    if (!sGrid || !hGrid) return;
    sGrid.innerHTML = ''; hGrid.innerHTML = '';
    for (const [key, sc] of Object.entries(shortcuts)) {
        const text = formatShortcutDisplay(sc);
        hGrid.innerHTML += `<div class="sc-item"><span>${sc.label}</span> <kbd style="font-family:monospace;font-weight:bold;color:var(--accent);background:var(--bg-panel);padding:2px 6px;border-radius:4px;border:1px solid var(--border);">${text}</kbd></div>`;
        const btn = document.createElement('button');
        btn.className = 'sc-btn'; btn.innerText = text;
        btn.onclick = ev => { ev.target.innerText = 'Listening…'; ev.target.classList.add('listening'); listeningAction = key; };
        const div = document.createElement('div'); div.className = 'sc-item';
        div.innerHTML = `<span>${sc.label}</span>`; div.appendChild(btn);
        sGrid.appendChild(div);
    }
    const lAction = document.getElementById('labelAction');
    const lScript = document.getElementById('labelScript');
    const lNote   = document.getElementById('labelNote');
    const uText   = document.getElementById('uploadText');
    if (lAction) lAction.innerText = `ACTION (${formatShortcutDisplay(shortcuts.action)}):`;
    if (lScript) lScript.innerText = `SCRIPT (${formatShortcutDisplay(shortcuts.script)}):`;
    if (lNote)   lNote.innerText   = `NOTE (${formatShortcutDisplay(shortcuts.note)}):`;
    if (uText)   uText.innerText   = `Click or press '${formatShortcutDisplay(shortcuts.video)}' to upload a video file`;

    // Load Google Sheets Web App URL input
    const sheetsUrlInput = document.getElementById('sheetsUrlInput');
    if (sheetsUrlInput) {
        sheetsUrlInput.value = googleSheetsUrl;
        if (!sheetsUrlInput.dataset.hasListener) {
            sheetsUrlInput.dataset.hasListener = "true";
            sheetsUrlInput.addEventListener('input', e => {
                googleSheetsUrl = e.target.value.trim();
                localStorage.setItem('autoscript_google_sheets_url', googleSheetsUrl);
            });
        }
    }

    // Load Google Client ID input
    const googleClientIdInput = document.getElementById('googleClientIdInput');
    if (googleClientIdInput) {
        googleClientIdInput.value = googleClientId;
        if (!googleClientIdInput.dataset.hasListener) {
            googleClientIdInput.dataset.hasListener = "true";
            googleClientIdInput.addEventListener('input', e => {
                googleClientId = e.target.value.trim();
                localStorage.setItem('autoscript_google_client_id', googleClientId);
                initGoogleOAuth(); // Re-init client client-side on change
            });
        }
    }

    // Bind Google Auth login status button
    const btnGoogleAuth = document.getElementById('btnGoogleAuth');
    if (btnGoogleAuth) {
        updateGoogleUI();
        if (!btnGoogleAuth.dataset.hasListener) {
            btnGoogleAuth.dataset.hasListener = "true";
            btnGoogleAuth.addEventListener('click', handleGoogleAuthClick);
        }
    }
}

// ── 9. RENDER TABLE ──────────────────────────────────────────
let searchQuery = '';
let filterQuery = 'ALL';

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
    });
}
const filterActionSel = document.getElementById('filterAction');
if (filterActionSel) {
    filterActionSel.addEventListener('change', e => {
        filterQuery = e.target.value;
        renderTable();
    });
}

window.updateRowAction = function(index, action) {
    if (index >= 0 && index < logs.length) {
        logs[index].action = action;
        renderTable();
        drawMarkers();
        saveSession();
    }
};

function renderTable() {
    const tw = document.querySelector('.table-wrap');
    const oldScrollTop = tw ? tw.scrollTop : 0;
    const tbody = document.getElementById('logBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let count = 0;
    logs.forEach((log, index) => {
        if (filterQuery !== 'ALL' && log.action !== filterQuery) return;
        if (searchQuery) {
            const text = (log.script + ' ' + log.note + ' ' + log.tcin + ' ' + log.tcout + ' ' + (log.tcswap || '')).toLowerCase();
            if (!text.includes(searchQuery)) return;
        }
        count++;
        const colorSet = actionColors[log.action] || actionColors['OTHERS'];
        const bg  = colorSet.bg, txt = colorSet.color;
        const playButton = (log.action === 'DELETE' || log.action === 'SWAP') ? `<button class="btn-play-delete" onclick="playActionPreview(${index})" title="Preview action">&#9658;</button>` : '';
        const isEditing = (index === editingRowIndex);
        const editable = isEditing ? 'contenteditable="true"' : '';
        const editClass = isEditing ? 'row-editing' : '';
        
        let actionCell;
        if (isEditing) {
            const opts = actionList.map(a => `<option value="${a}" ${a === log.action ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('');
            actionCell = `<select onchange="window.updateRowAction(${index}, this.value)" style="width:auto; padding:4px 10px; font-size:11px; font-weight:600; background:${bg}; color:${txt}; border:1px solid rgba(255,255,255,0.2); border-radius:12px; outline:none; text-align:center; cursor:pointer; font-family:'Outfit',sans-serif;">${opts}</select>`;
        } else {
            actionCell = `<span class="action-tag" style="background:${bg};color:${txt}">${escapeHtml(log.action)}</span>`;
        }
        
        tbody.innerHTML += `
            <tr id="row-${index}" class="log-row ${editClass}" oncontextmenu="showRowMenu(event, ${index})">
                <td class="td-stt">${index + 1}</td>
                <td class="td-play" style="text-align:center;"><span class="row-tools">${playButton}</span></td>
                <td class="td-action">${actionCell}</td>
                <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcswap')" onblur="inlineUpdate(${index},'tcswap',this)">${escapeHtml(log.tcswap || '')}</td>
                <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcin')" onblur="inlineUpdate(${index},'tcin',this)">${escapeHtml(log.tcin)}</td>
                <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcout')" onblur="inlineUpdate(${index},'tcout',this)">${escapeHtml(log.tcout === '00:00:00:00' ? '' : log.tcout)}</td>
                <td class="td-text" ${editable} onblur="inlineUpdate(${index},'script',this)">${escapeHtml(log.script)}</td>
                <td class="td-text" ${editable} onblur="inlineUpdate(${index},'note',this)">${escapeHtml(log.note)}</td>
                <td class="td-delete"><span class="row-tools"><button class="btn-delete" onclick="deleteLog(${index})" title="Delete">&#10006;</button></span></td>
            </tr>`;
    });
    const logCount = document.getElementById('logCount');
    if (logCount) logCount.innerText = count;
    if (tw) tw.scrollTop = oldScrollTop;
}

// ── 10. DRAW TIMELINE MARKERS ────────────────────────────────
function drawMarkers() {
    Array.from(timelineWrapper.querySelectorAll('.marker-range')).forEach(el => el.remove());
    if (!video.duration || !logs.length) return;

    // Sort by duration descending so longer items render first (behind shorter ones)
    const sortedLogs = logs.map((log, origIndex) => ({ log, origIndex })).sort((a, b) => {
        const durA = (a.log.outSec && a.log.outSec > a.log.inSec) ? (a.log.outSec - a.log.inSec) : 0;
        const durB = (b.log.outSec && b.log.outSec > b.log.inSec) ? (b.log.outSec - b.log.inSec) : 0;
        return durB - durA;
    });

    const placed = [];

    sortedLogs.forEach(item => {
        const log = item.log;
        const origIndex = item.origIndex;
        const colorSet = actionColors[log.action] || actionColors['OTHERS'];
        const colorHex = colorSet.bg;
        const hasDuration = log.outSec && log.outSec > log.inSec;
        const startSec = log.inSec;
        const endSec = hasDuration ? log.outSec : log.inSec + 0.1;
        const startPct = (startSec / video.duration) * 100;
        
        let level = 0;
        while (placed.some(p => p.level === level && Math.max(startSec, p.start) < Math.min(endSec, p.end))) {
            level++;
        }
        placed.push({ start: startSec, end: endSec, level: level });

        let hideText = false;
        if (hasDuration) {
            const timelineWidthPx = document.getElementById('customTimeline').clientWidth || timelineWrapper.clientWidth * 1;
            const markerWidthPx = ((endSec - startSec) / video.duration) * timelineWidthPx;
            if (markerWidthPx < 50) hideText = true;
        }

        const marker = document.createElement('div');
        marker.className = 'marker-range';

        marker.style.left  = startPct + '%';
        if (hasDuration) {
            marker.style.width = ((endSec - startSec) / video.duration) * 100 + '%';
        } else {
            marker.style.width = '0%';
        }
        marker.style.borderLeftColor  = colorHex;
        marker.style.borderRightColor = colorHex;
        marker.style.backgroundColor  = colorHex + '50';
        
        const topOffsetDur = 24 + (level * 22);
        const topOffsetNoDur = 36 + (level * 22);
        const lineOffsetNoDur = 16 + (level * 22);

        let pillHTML = '';
        if (hasDuration) {
            pillHTML = `
                <div class="action-pill" style="position:absolute; top:-${topOffsetDur}px; left:0; width:100%; height:18px; display:flex; align-items:center; justify-content:center; background:${colorHex}; color:${colorSet.color}; font-size:10px; font-weight:bold; border-radius:6px; pointer-events:auto; cursor:pointer; border:1px solid rgba(255,255,255,0.3); z-index:5; box-shadow:0 2px 4px rgba(0,0,0,0.3); overflow:hidden; text-overflow:ellipsis;">
                    <span class="action-pill-text" style="display: ${hideText ? 'none' : 'inline'}">${escapeHtml(log.action)}</span>
                </div>
            `;
        } else {
            pillHTML = `
                <div class="action-pill" style="position:absolute; top:-${topOffsetNoDur}px; left:0; transform:translateX(-50%); background:${colorHex}; width:6px; height:18px; border-radius:3px; pointer-events:auto; cursor:pointer; border:1px solid rgba(255,255,255,0.5); z-index:5; box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                </div>
                <div style="position:absolute; top:-${lineOffsetNoDur}px; left:0; transform:translateX(-50%); width:2px; height:${lineOffsetNoDur}px; background:rgba(255,255,255,0.3); z-index:4;"></div>
            `;
        }
        // Swap indicator is drawn separately on the timeline wrapper below
        let tooltipContent = '';
        if (log.script) tooltipContent += `<div style="margin-bottom:4px;"><strong style="color:#aaa;">Script:</strong><br>${escapeHtml(log.script)}</div>`;
        if (log.note) tooltipContent += `<div><strong style="color:#aaa;">Note:</strong><br>${escapeHtml(log.note)}</div>`;

        marker.innerHTML = pillHTML;
        
        marker.addEventListener('mousedown', ev => { 
            if (ev.target.closest('.action-pill')) {
                ev.stopPropagation();
                window.jumpToTC(origIndex, 'tcin');
            }
        });
        
        marker.addEventListener('mouseenter', () => {
            if (!tooltipContent) return;
            let gt = document.getElementById('globalTooltip');
            if (!gt) {
                gt = document.createElement('div');
                gt.id = 'globalTooltip';
                gt.style.cssText = `display:none; flex-direction:column; align-items:flex-start; gap:4px; padding:8px 12px; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.2); border-radius:8px; z-index:99999; position:fixed; pointer-events:none; max-width:500px; box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
                document.body.appendChild(gt);
            }
            gt.style.background = `${colorHex}F2`; // 95% opacity
            gt.innerHTML = `<span style="font-size:12px;text-align:left;white-space:pre-wrap;color:white;line-height:1.4;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${tooltipContent}</span>`;
            gt.style.display = 'flex';
            const pill = marker.querySelector('.action-pill');
            const rect = (pill || marker).getBoundingClientRect();
            gt.style.left = (rect.left + rect.width / 2) + 'px';
            gt.style.top = (rect.top - 10) + 'px';
            gt.style.transform = 'translate(-50%, -100%)';
        });
        
        marker.addEventListener('mouseleave', () => {
            const gt = document.getElementById('globalTooltip');
            if (gt) gt.style.display = 'none';
        });
        
        timelineWrapper.appendChild(marker);
        
        if (log.action === 'SWAP' && log.swapSec != null) {
            const swapLeftPct = (log.swapSec / video.duration) * 100;
            const swapMarker = document.createElement('div');
            swapMarker.className = 'marker-range marker-swap';
            swapMarker.style.position = 'absolute';
            swapMarker.style.top = '0';
            swapMarker.style.height = '100%';
            swapMarker.style.left = swapLeftPct + '%';
            swapMarker.style.pointerEvents = 'auto';
            swapMarker.style.cursor = 'pointer';
            swapMarker.innerHTML = `
                <div style="position:absolute; top: -14px; left: 0; transform: translateX(-50%); width: 14px; height: calc(100% + 14px); z-index: 6;">
                    <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 100%; background: #ea580c;"></div>
                    <div style="position:absolute; top: -5px; left: 50%; transform: translateX(-50%); border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #ea580c;"></div>
                </div>
            `;
            swapMarker.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                video.currentTime = log.swapSec;
            });
            timelineWrapper.appendChild(swapMarker);
        }
    });
}

// ── 11. PLAYBACK ─────────────────────────────────────────────
function togglePlayback() {
    if (video.paused) video.play();
    else video.pause();
}

function updateToolbarPlayState() {
    if (!video.paused) {
        btnPlayVideo.innerHTML = '&#10074;&#10074;';
        btnPlayVideo.classList.remove('primary');
        btnPlayVideo.title = 'Tạm dừng video';
        if (reverseInterval) { clearInterval(reverseInterval); reverseInterval = null; if (btnPlayReverse) btnPlayReverse.classList.remove('active'); }
    } else if (reverseInterval) {
        btnPlayVideo.innerHTML = '&#10074;&#10074;';
        btnPlayVideo.classList.remove('primary');
        btnPlayVideo.title = 'Tạm dừng tua lùi';
    } else {
        btnPlayVideo.innerHTML = '&#9658;';
        btnPlayVideo.classList.add('primary');
        btnPlayVideo.title = 'Phát video';
    }
    btnPlayVideo.setAttribute('aria-label', btnPlayVideo.title);
}

// ── 12. TIMELINE + ACTIVE RANGE ──────────────────────────────
function updateActiveRange() {
    if (!video.duration) return;
    const draftMarker = document.getElementById('draftMarker');
    const swapIndicator = document.getElementById('activeSwapIndicator');
    
    if (btnToolbarImport) {
        if (activeInSec !== null) btnToolbarImport.classList.add('pulse-import');
        else btnToolbarImport.classList.remove('pulse-import');
    }

    if (activeInSec !== null && activeOutSec !== null) { 
        activeRange.style.display = 'block';
        activeRange.style.left  = (activeInSec / video.duration) * 100 + '%';
        activeRange.style.width = ((activeOutSec - activeInSec) / video.duration) * 100 + '%';
        
        const colorSet = actionColors[selectedAction] || {bg: 'rgba(239, 68, 68, 0.4)'};
        activeRange.style.background = colorSet.bg + '66'; // 0.4 alpha
        activeRange.style.borderLeftColor = colorSet.bg;
        activeRange.style.borderRightColor = colorSet.bg;
        
        if (draftMarker) draftMarker.style.display = 'none';
    } else if (activeInSec !== null && activeOutSec === null) {
        activeRange.style.display = 'none';
        if (draftMarker) {
            draftMarker.style.display = 'block';
            const draftOut = Math.max(activeInSec, video.currentTime);
            draftMarker.style.left = (activeInSec / video.duration) * 100 + '%';
            draftMarker.style.width = ((draftOut - activeInSec) / video.duration) * 100 + '%';
            const colorSet = actionColors[selectedAction] || {bg: 'rgba(255,255,255,0.7)'};
            draftMarker.style.background = colorSet.bg;
            draftMarker.style.opacity = '0.5';
        }
    } else {
        activeRange.style.display = 'none';
        if (draftMarker) draftMarker.style.display = 'none';
    }
    
    if (selectedAction === 'SWAP' && activeSwapSec !== null) {
        if (swapIndicator) {
            swapIndicator.style.display = 'block';
            swapIndicator.style.left = (activeSwapSec / video.duration) * 100 + '%';
        }
    } else {
        if (swapIndicator) swapIndicator.style.display = 'none';
    }
}

// ── 13. TC IN / OUT ──────────────────────────────────────────
function markInPoint() {
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeInSec = video.currentTime;
        valTcIn.innerText = formatTC(activeInSec);
        logs[editingRowIndex].inSec = activeInSec;
        logs[editingRowIndex].tcin = formatTC(activeInSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[4]) cells[4].innerText = formatTC(activeInSec);
        }
        drawMarkers();
        updateActiveRange();
        return;
    }
    activeInSec = video.currentTime;
    if (activeOutSec !== null && activeOutSec <= activeInSec) {
        activeOutSec = null;
        valTcOut.innerText = formatTC(video.currentTime);
        boxOut.classList.remove('active');
    }
    valTcIn.innerText = formatTC(activeInSec);
    boxIn.classList.add('active');
    updateActiveRange();
}

function markOutPoint() {
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeOutSec = video.currentTime;
        valTcOut.innerText = formatTC(activeOutSec);
        logs[editingRowIndex].outSec = activeOutSec;
        logs[editingRowIndex].tcout = formatTC(activeOutSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[5]) cells[5].innerText = formatTC(activeOutSec);
        }
        drawMarkers();
        updateActiveRange();
        return;
    }
    activeOutSec = video.currentTime;
    if (activeInSec !== null && activeInSec >= activeOutSec) {
        activeInSec = null;
        valTcIn.innerText = formatTC(video.currentTime);
        boxIn.classList.remove('active');
    }
    valTcOut.innerText = formatTC(activeOutSec);
    boxOut.classList.add('active');
    updateActiveRange();
}

function markSwapPoint() {
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeSwapSec = video.currentTime;
        valTcSwap.innerText = formatTC(activeSwapSec);
        logs[editingRowIndex].swapSec = activeSwapSec;
        logs[editingRowIndex].tcswap = formatTC(activeSwapSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[3]) cells[3].innerText = formatTC(activeSwapSec);
        }
        drawMarkers();
        updateActiveRange();
        return;
    }
    activeSwapSec = video.currentTime;
    if (valTcSwap) valTcSwap.innerText = formatTC(activeSwapSec);
    if (boxSwap) boxSwap.classList.add('active');
    updateActiveRange();
}

// ── 14. JUMP MARKER ──────────────────────────────────────────
function jumpMarker(direction) {
    if (!logs.length) return;
    const sorted = [...logs].sort((a,b) => a.inSec - b.inSec);
    let target = null;
    if (direction === 1) {
        const next = sorted.find(l => l.inSec > video.currentTime + 0.5);
        if (next) target = next.inSec;
    } else {
        const prevs = sorted.filter(l => l.inSec < video.currentTime - 0.5);
        if (prevs.length) target = prevs[prevs.length - 1].inSec;
    }
    if (target !== null) video.currentTime = target;
}

// ── 15. SAVE LOG (Import Action) ─────────────────────────────
function logAction(actionName) {
    if (!video.duration) return;
    
    if (actionName === 'DELETE') {
        if (editingRowIndex !== null && logs[editingRowIndex].outSec === null && activeOutSec === null) {
            alert('Lỗi: Action DELETE bắt buộc phải có TC OUT. Vui lòng thêm TC OUT!');
            return;
        } else if (editingRowIndex === null && activeOutSec === null) {
            alert('Lỗi: Action DELETE bắt buộc phải có TC OUT. Vui lòng thêm TC OUT!');
            return;
        }
    }

    if (editingRowIndex !== null) {
        if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
            document.activeElement.blur();
        }
        // Update the log data
        logs[editingRowIndex].action = actionName;
        // Update the selected action UI
        selectedAction = actionName;
        updateActionButtons();
        if (boxSwap) boxSwap.style.display = actionName === 'SWAP' ? 'block' : 'none';
        // Re-render table to show new action tag
        renderTable();
        drawMarkers();
        return;
    }

    if (activeInSec === null) return;
    
    saveState();
    const st = document.getElementById('inputScript').value.trim();
    const nt = document.getElementById('inputNote').value.trim();
    logs.push({
        action: actionName,
        inSec: activeInSec,
        outSec: activeOutSec,
        swapSec: activeSwapSec,
        tcswap: activeSwapSec !== null ? formatTC(activeSwapSec) : '',
        tcin: formatTC(activeInSec),
        tcout: activeOutSec !== null ? formatTC(activeOutSec) : '',
        script: st,
        note: nt
    });
    logs.sort((a, b) => a.inSec - b.inSec);
    saveSession();
    renderTable(); drawMarkers();

    const newIdx = logs.findIndex(l => l.inSec === activeInSec && l.action === actionName && l.script === st && l.note === nt);
    if (newIdx >= 0) {
        const row = document.getElementById('row-' + newIdx);
        if (row) {
            row.classList.add('highlight-new');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => row.classList.remove('highlight-new'), 2000);
        }
    }

    activeInSec = null; activeOutSec = null; activeSwapSec = null;
    valTcIn.innerText = formatTC(video.currentTime);
    valTcOut.innerText = formatTC(video.currentTime);
    if (valTcSwap) valTcSwap.innerText = formatTC(video.currentTime);
    document.getElementById('inputScript').value = '';
    document.getElementById('inputNote').value = '';
    updateActiveRange();
    boxIn.classList.remove('active');
    boxOut.classList.remove('active');
    if (boxSwap) boxSwap.classList.remove('active');

    renderTable();
    drawMarkers();
}

function saveLog() {
    logAction(selectedAction);
}

// ── 16. PREVIEW CUT ──────────────────────────────────────────
function togglePreviewCut() {
    isPreviewCut = !isPreviewCut;
    btnPreviewCut.classList.toggle('active', isPreviewCut);
    btnPreviewCut.title = isPreviewCut ? 'Preview Cut: ON (P)' : 'Preview Cut: OFF (P)';
}

// ── 17. ACTION BUTTONS STATE ─────────────────────────────────
function updateActionButtons() {
    actionButtons.forEach(btn => {
        const action = btn.dataset.action;
        const colorSet = actionColors[action] || actionColors['OTHERS'];
        const active = action === selectedAction;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', String(active));
        btn.style.setProperty('--action-bg', colorSet.bg);
        btn.style.setProperty('--action-color', colorSet.color);
    });
}

function setSelectedAction(action) {
    if (!actionColors[action]) return;
    selectedAction = action;
    updateActionButtons();
    if (boxSwap) {
        boxSwap.style.display = action === 'SWAP' ? 'block' : 'none';
    }
    updateActiveRange();
    // If in edit mode, also update the editing row's action
    if (editingRowIndex !== null) {
        logs[editingRowIndex].action = action;
        renderTable();
        drawMarkers();
    }
}

// ── 18. INLINE TABLE EDIT ────────────────────────────────────
window.inlineUpdate = function(index, field, element) {
    saveState();
    logs[index][field] = element.value || element.innerText.trim();
    if (field === 'tcswap') { logs[index].swapSec = parseTC(logs[index].tcswap); drawMarkers(); }
    if (field === 'tcin')  { logs[index].inSec  = parseTC(logs[index].tcin);  drawMarkers(); }
    if (field === 'tcout') { logs[index].outSec = parseTC(logs[index].tcout); drawMarkers(); }
    saveSession();
};

window.jumpToTC = function(index, field) {
    const log = logs[index];
    const sec = parseTC(log[field]);
    if (sec !== null && !isNaN(sec)) {
        video.currentTime = sec;
        let targetZoom = 50;
        if (log.inSec !== null && log.outSec !== null && log.outSec > log.inSec) {
            const dur = log.outSec - log.inSec;
            targetZoom = video.duration / (dur * 3);
            if (targetZoom < 1) targetZoom = 1;
            if (targetZoom > 50) targetZoom = 50;
        }
        applyZoom(targetZoom);
        
        if (log.inSec !== null && log.outSec !== null && log.outSec > log.inSec) {
            setTimeout(() => {
                const wrapper = document.querySelector('.custom-timeline-wrapper');
                const timeline = document.getElementById('customTimeline');
                if (wrapper && timeline) {
                    const centerSec = log.inSec + (log.outSec - log.inSec) / 2;
                    const centerX = (centerSec / video.duration) * timeline.offsetWidth;
                    wrapper.scrollLeft = centerX - (wrapper.offsetWidth / 2);
                }
            }, 10);
        }
    }
};

window.deleteLog = function(index) {
    saveState(); logs.splice(index, 1); 
    if (editingRowIndex === index) editingRowIndex = null;
    else if (editingRowIndex > index) editingRowIndex--;
    renderTable(); drawMarkers(); saveSession();
};

function endPreview() {
    if (previewState.restorePreviewCut) {
        isPreviewCut = originalPreviewCutState;
        btnPreviewCut.classList.toggle('active', isPreviewCut);
        btnPreviewCut.title = isPreviewCut ? 'Preview Cut: ON (P)' : 'Preview Cut: OFF (P)';
        previewState.restorePreviewCut = false;
    }
    previewState.active = false;
}

window.playActionPreview = function(index) {
    const log = logs[index];
    if (!log) return;
    
    // Remember original state and FORCE ON
    originalPreviewCutState = isPreviewCut;
    if (!isPreviewCut) {
        isPreviewCut = true;
        btnPreviewCut.classList.add('active');
        btnPreviewCut.title = 'Preview Cut: ON (P)';
    }
    
    previewState.active = true;
    previewState.logIndex = index;
    previewState.restorePreviewCut = true;
    
    if (log.action === 'SWAP') {
        previewState.phase = 1;
        const sSec = Number.isFinite(log.swapSec) ? log.swapSec : parseTC(log.tcswap);
        if (Number.isFinite(sSec) && sSec > 0) {
            video.currentTime = Math.max(0, sSec - 3);
            video.play();
        } else {
            previewState.phase = 2;
            const iSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
            video.currentTime = iSec;
            video.play();
        }
    } else {
        previewState.phase = 0; // Standard preview
        const startSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
        if (Number.isFinite(startSec)) {
            video.currentTime = Math.max(0, startSec - 3);
            video.play();
        }
    }

    let targetZoom = 50;
    if (log.inSec !== null && log.outSec !== null && log.outSec > log.inSec) {
        const dur = log.outSec - log.inSec;
        targetZoom = video.duration / (dur * 3);
        if (targetZoom < 1) targetZoom = 1;
        if (targetZoom > 50) targetZoom = 50;
    }
    applyZoom(targetZoom);
    if (log.inSec !== null && log.outSec !== null && log.outSec > log.inSec) {
        setTimeout(() => {
            const wrapper = document.querySelector('.custom-timeline-wrapper');
            const timeline = document.getElementById('customTimeline');
            if (wrapper && timeline) {
                const centerSec = log.inSec + (log.outSec - log.inSec) / 2;
                const centerX = (centerSec / video.duration) * timeline.offsetWidth;
                wrapper.scrollLeft = centerX - (wrapper.offsetWidth / 2);
            }
        }, 10);
    }
};

// ── 20. SKIP / JUMP ──────────────────────────────────────────
function skipTime(seconds) {
    if (!video.duration) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

function showTimecodeJump() {
    const overlay = document.getElementById('tcJumpOverlay');
    const input = document.getElementById('tcJumpInput');
    if (!overlay || !input) return;
    overlay.style.display = 'flex';
    input.value = bigTc.innerText;
    input.focus();
    input.select();
}

function hideTimecodeJump() {
    const overlay = document.getElementById('tcJumpOverlay');
    if (overlay) overlay.style.display = 'none';
}

function executeTimecodeJump() {
    const input = document.getElementById('tcJumpInput');
    if (!input) return;
    const sec = parseTC(input.value);
    if (sec > 0 && sec <= video.duration) {
        video.currentTime = sec;
    }
    hideTimecodeJump();
}

// ── 22. EVENT LISTENERS ──────────────────────────────────────

// -- Resize --
resizerV.addEventListener('mousedown', e => { isResizingV = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
if (resizerH1) resizerH1.addEventListener('mousedown', e => { isResizingH1 = true; document.body.style.cursor = 'row-resize'; e.preventDefault(); });
if (resizerH2) resizerH2.addEventListener('mousedown', e => { isResizingH2 = true; document.body.style.cursor = 'row-resize'; e.preventDefault(); });

window.addEventListener('mousemove', e => {
    if (isResizingV) {
        const rect = mainContainer.getBoundingClientRect();
        const pct  = ((e.clientX - rect.left) / rect.width) * 100;
        if (pct > 20 && pct < 80) { leftCol.style.width = pct + '%'; rightCol.style.width = (100 - pct) + '%'; }
    }
    if (isResizingH1) {
        const rect = leftCol.getBoundingClientRect();
        const topH = e.clientY - rect.top;
        if (topH > 100 && topH < rect.height - 250) {
            videoSection.style.height = topH + 'px';
            videoSection.style.flex = 'none';
        }
    }
    if (isResizingH2) {
        const rect = leftCol.getBoundingClientRect();
        const formH = rect.bottom - e.clientY;
        if (formH > 100 && formH < rect.height - 250) {
            formSection.style.height = formH + 'px';
            formSection.style.flex = 'none';
        }
    }
    if (isDraggingFloat) {
        floatPanel.style.left = (e.clientX - floatOffsetX) + 'px';
        floatPanel.style.top  = (e.clientY - floatOffsetY) + 'px';
    }
    if (isDraggingSpeed) {
        const dx = e.clientX - speedStartX;
        if (Math.abs(dx) > 3) speedDidDrag = true;
        const newSpeed = Math.max(0.25, Math.min(speedStartVal + Math.round(dx / 10) * 0.25, 10.0));
        if (Math.abs(newSpeed - playbackSpeed) > 0.05) {
            playbackSpeed = newSpeed; video.playbackRate = playbackSpeed;
            speedDisplay.innerText = playbackSpeed.toFixed(2) + 'x';
        }
    }
});

window.addEventListener('mouseup', () => {
    isResizingV = false; isResizingH1 = false; isResizingH2 = false;
    isDraggingFloat = false; isDraggingSpeed = false;
    document.body.style.cursor = 'default';
});

// -- Float panel --
document.getElementById('btnHelp').onclick = () => {
    floatPanel.style.display = floatPanel.style.display === 'flex' ? 'none' : 'flex';
};
document.getElementById('btnCloseHelp').onclick = () => { floatPanel.style.display = 'none'; };
floatHeader.addEventListener('mousedown', e => {
    isDraggingFloat = true;
    floatOffsetX = e.clientX - floatPanel.offsetLeft;
    floatOffsetY = e.clientY - floatPanel.offsetTop;
    document.body.style.cursor = 'move';
});

// -- Settings modal --
document.getElementById('btnShortcuts').onclick   = () => { mSettings.style.display = 'flex'; };
document.getElementById('btnCloseSettings').onclick = () => { mSettings.style.display = 'none'; };

// -- Master TC Clicks --
boxIn.addEventListener('click', () => {
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeInSec = video.currentTime;
        valTcIn.innerText = formatTC(activeInSec);
        logs[editingRowIndex].inSec = activeInSec;
        logs[editingRowIndex].tcin = formatTC(activeInSec);
        // Update the table cell directly (TC IN is column index 4: STT, Play, Action, Swap, IN)
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[4]) cells[4].innerText = formatTC(activeInSec);
        }
        drawMarkers();
        updateActiveRange();
        return;
    }
    if (activeInSec !== null) {
        activeInSec = null;
        boxIn.classList.remove('active');
        valTcIn.innerText = formatTC(video.currentTime);
        updateActiveRange();
    } else {
        activeInSec = video.currentTime;
        valTcIn.innerText = formatTC(activeInSec);
        boxIn.classList.add('active');
        updateActiveRange();
    }
});

boxOut.addEventListener('click', () => {
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeOutSec = video.currentTime;
        valTcOut.innerText = formatTC(activeOutSec);
        logs[editingRowIndex].outSec = activeOutSec;
        logs[editingRowIndex].tcout = formatTC(activeOutSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[5]) cells[5].innerText = formatTC(activeOutSec);
        }
        drawMarkers();
        updateActiveRange();
        return;
    }
    if (activeOutSec !== null) {
        activeOutSec = null;
        boxOut.classList.remove('active');
        valTcOut.innerText = formatTC(video.currentTime);
        updateActiveRange();
    } else {
        activeOutSec = video.currentTime;
        valTcOut.innerText = formatTC(activeOutSec);
        boxOut.classList.add('active');
        updateActiveRange();
    }
});

if (boxSwap) {
    boxSwap.addEventListener('click', () => {
        if (!video.duration) return;
        if (editingRowIndex !== null) {
            activeSwapSec = video.currentTime;
            valTcSwap.innerText = formatTC(activeSwapSec);
            logs[editingRowIndex].swapSec = activeSwapSec;
            logs[editingRowIndex].tcswap = formatTC(activeSwapSec);
            const row = document.getElementById(`row-${editingRowIndex}`);
            if (row) {
                const cells = row.querySelectorAll('td');
                if (cells[3]) cells[3].innerText = formatTC(activeSwapSec);
            }
            drawMarkers();
            updateActiveRange();
            return;
        }
        if (activeSwapSec !== null) {
            activeSwapSec = null;
            boxSwap.classList.remove('active');
            valTcSwap.innerText = formatTC(video.currentTime);
            updateActiveRange();
        } else {
            activeSwapSec = video.currentTime;
            valTcSwap.innerText = formatTC(activeSwapSec);
            boxSwap.classList.add('active');
            updateActiveRange();
        }
    });
}

// -- Theme --
document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

const fpsSelect = document.getElementById('fpsSelect');
if (fpsSelect) {
    fpsSelect.addEventListener('change', (e) => {
        FPS = parseFloat(e.target.value);
        if (video.duration) {
            document.getElementById('tcEnd').innerText = formatBoundTC(video.duration);
            bigTc.innerText = formatTC(video.currentTime);
            renderTable();
            drawMarkers();
            renderTimelineTicks();
        }
    });
}

// -- Action buttons --
actionButtons.forEach(btn => btn.addEventListener('click', () => setSelectedAction(btn.dataset.action)));

// -- Video upload --
upload.addEventListener('change', e => {
    if (e.target.files[0]) {
        if (video.src && video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
        video.src = URL.createObjectURL(e.target.files[0]);
        document.getElementById('uploadText').innerText = e.target.files[0].name;
        if (window.db) {
            const tx = window.db.transaction('videoStore', 'readwrite');
            tx.objectStore('videoStore').put(e.target.files[0], 'lastVideo');
        }
    }
});



// -- Video events --
video.addEventListener('loadedmetadata', () => {
    document.getElementById('tcStart').innerText = '00:00';
    document.getElementById('tcEnd').innerText = formatBoundTC(video.duration);
    drawMarkers();
    renderTimelineTicks();
});
document.getElementById('tcStart').addEventListener('click', () => { video.currentTime = 0; });
document.getElementById('tcEnd').addEventListener('click', () => { if (video.duration) video.currentTime = video.duration; });
video.addEventListener('focus', () => video.blur());

// -- Play / Pause button --
btnPlayVideo.addEventListener('click', () => {
    if (reverseInterval) {
        clearInterval(reverseInterval); reverseInterval = null;
        if (btnPlayReverse) btnPlayReverse.classList.remove('active');
    }
    togglePlayback();
});
video.addEventListener('play',  updateToolbarPlayState);
video.addEventListener('pause', updateToolbarPlayState);

// -- Play Reverse --
if (btnPlayReverse) {
    btnPlayReverse.addEventListener('click', () => {
        if (!video.paused) video.pause();
        if (reverseInterval) {
            clearInterval(reverseInterval); reverseInterval = null;
            btnPlayReverse.classList.remove('active');
            updateToolbarPlayState();
        } else {
            reverseInterval = setInterval(() => {
                if (video.currentTime <= 0.05) {
                    clearInterval(reverseInterval); reverseInterval = null;
                    btnPlayReverse.classList.remove('active');
                    video.currentTime = 0;
                    updateToolbarPlayState();
                } else {
                    video.currentTime -= 0.05;
                }
            }, 50);
            btnPlayReverse.classList.add('active');
            updateToolbarPlayState();
        }
    });
}

// -- Import Action button --
if (btnToolbarImport) btnToolbarImport.addEventListener('click', saveLog);

// -- Big TC --
bigTc.addEventListener('click', function() {
    navigator.clipboard.writeText(this.innerText);
    this.style.color = 'var(--success)';
    setTimeout(() => { this.style.color = 'var(--accent)'; }, 500);
});
bigTc.addEventListener('dblclick', function(e) {
    e.preventDefault();
    showTimecodeJump();
});

// -- Speed control --
speedDisplay.addEventListener('mousedown', e => {
    isDraggingSpeed = true; speedDidDrag = false;
    speedStartX = e.clientX; speedStartVal = playbackSpeed;
    document.body.style.cursor = 'ew-resize'; e.preventDefault();
});
speedDisplay.addEventListener('click', e => {
    if (speedDidDrag) return;
    e.stopPropagation();
    playbackSpeed = 1;
    video.playbackRate = 1;
    speedDisplay.innerText = '1.00x';
});

// Global Click Handling (Context Menu & Edit Persistence)
document.addEventListener('mousedown', (e) => { 
    if (e.target.closest('.tc-jump-overlay')) return;
    const menu = document.getElementById('rowContextMenu');
    if (menu && e.target.closest('#rowContextMenu') === null) {
        menu.style.display = 'none';
    }
    if (editingRowIndex !== null) {
        const row = document.getElementById(`row-${editingRowIndex}`);
        // Stay in edit mode if clicking within the editing row
        if (row && row.contains(e.target)) return;
        // Stay in edit mode if clicking context menu
        if (e.target.closest('.context-menu')) return;
        // Stay in edit mode if clicking ANY workspace element
        if (e.target.closest('.form-section')) return;
        if (e.target.closest('.tc-row')) return;
        if (e.target.closest('.action-button-group')) return;
        if (e.target.closest('.action-button')) return;
        if (e.target.closest('#btnToolbarImport')) return;
        if (e.target.closest('.custom-timeline-wrapper')) return;
        // Stay in edit mode if clicking TC boxes
        if (e.target.closest('#boxIn') || e.target.closest('#boxOut') || e.target.closest('#boxSwap')) return;
        // Exit edit mode for everything else
        saveEdit();
    }
});

document.querySelectorAll('#speedMenu li').forEach(li => {
    li.addEventListener('click', e => {
        playbackSpeed = parseFloat(e.target.getAttribute('data-speed'));
        video.playbackRate = playbackSpeed;
        speedDisplay.innerText = playbackSpeed.toFixed(2) + 'x';
    });
});

// -- Global listeners --
document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.log-row') && !e.target.closest('.context-menu')) {
        hideContextMenu();
    }
});

// Mirror Workspace script/note to Edit Row (bidirectional sync)
document.getElementById('inputScript').addEventListener('input', function(e) {
    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        logs[editingRowIndex].script = e.target.value;
        // Also update the rendered table cell
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[6]) cells[6].innerText = e.target.value;
        }
    }
});
document.getElementById('inputNote').addEventListener('input', function(e) {
    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        logs[editingRowIndex].note = e.target.value;
        // Also update the rendered table cell
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells[7]) cells[7].innerText = e.target.value;
        }
    }
});

// -- Volume --
document.getElementById('volumeSlider').addEventListener('input', e => { video.volume = e.target.value; });

// -- Preview Cut --
btnPreviewCut.addEventListener('click', togglePreviewCut);

// -- Timeline hover tooltip --
timelineWrapper.addEventListener('mousemove', e => {
    if (!video.duration) { hoverTooltip.style.display = 'none'; return; }
    const rect = timelineWrapper.getBoundingClientRect();
    const xPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const hoverSec = (xPos / rect.width) * video.duration;
    hoverTooltip.style.display = 'block';
    hoverTooltip.style.left = xPos + 'px';
    hoverTooltip.innerText = formatTC(hoverSec);
});
timelineWrapper.addEventListener('mouseleave', () => { hoverTooltip.style.display = 'none'; });

// -- Timeline drag scrub --
let isScrubbingTimeline = false;
timelineWrapper.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!video.duration) return;
    isScrubbingTimeline = true;
    updateTimelineScrub(e);
});
window.addEventListener('mousemove', e => {
    if (isScrubbingTimeline) updateTimelineScrub(e);
});
window.addEventListener('mouseup', e => {
    if (isScrubbingTimeline) {
        isScrubbingTimeline = false;
        seekToScrub(e);
    }
});
function updateTimelineScrub(e) {
    if (!video.duration) return;
    const customTimeline = document.getElementById('customTimeline');
    const rect = customTimeline.getBoundingClientRect();
    let xPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = (xPos / rect.width) * 100;
    const playhead = document.getElementById('playheadIndicator');
    if (playhead) playhead.style.left = pct + '%';
    timelineProgress.style.width = pct + '%';
    const ct = (xPos / rect.width) * video.duration;
    bigTc.innerText = formatTC(ct);
    video.currentTime = ct;
}
function seekToScrub(e) {
    if (!video.duration) return;
    const customTimeline = document.getElementById('customTimeline');
    const rect = customTimeline.getBoundingClientRect();
    let xPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    video.currentTime = (xPos / rect.width) * video.duration;
}

// -- timeupdate --
video.addEventListener('timeupdate', () => {
    const ct = video.currentTime;
    if (!video.duration) return;
    if (!isScrubbingTimeline) {
        const pct = (ct / video.duration) * 100;
        timelineProgress.style.width = pct + '%';
        const playhead = document.getElementById('playheadIndicator');
        if (playhead) playhead.style.left = pct + '%';
        bigTc.innerText = formatTC(ct);
    }
    
    if (activeInSec === null && valTcIn) valTcIn.innerText = formatTC(ct);
    if (activeOutSec === null && valTcOut) valTcOut.innerText = formatTC(ct);
    if (activeSwapSec === null && valTcSwap) valTcSwap.innerText = formatTC(ct);
    
    let activeColor = 'var(--text-main)';
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const end = log.outSec ? log.outSec : log.inSec + 1;
        const row = document.getElementById('row-' + i);
        if (ct >= log.inSec - 0.05 && ct < end) {
            const colorSet = actionColors[log.action] || actionColors['OTHERS'];
            activeColor = colorSet.bg;
            if (row) row.classList.add('highlight-playing');
        } else {
            if (row) row.classList.remove('highlight-playing');
        }
    }
    bigTc.style.color = activeColor;
    if (activeInSec !== null && activeOutSec === null) updateActiveRange();

    if (isPreviewCut) {
        const isReversing = reverseInterval !== null;
        for (let i = 0; i < logs.length; i++) {
            if (logs[i].action === 'DELETE' && logs[i].outSec) {
                if (ct >= logs[i].inSec && ct < logs[i].outSec) {
                    if (isReversing) {
                        video.currentTime = logs[i].inSec - 0.05;
                    } else {
                        video.currentTime = logs[i].outSec;
                    }
                    break;
                }
            }
        }
    }
    if (previewState && previewState.active) {
        const log = logs[previewState.logIndex];
        if (log) {
            if (log.action === 'SWAP') {
                const sSec = Number.isFinite(log.swapSec) ? log.swapSec : parseTC(log.tcswap);
                const iSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
                const oSec = Number.isFinite(log.outSec) ? log.outSec : parseTC(log.tcout);
                if (previewState.phase === 1) {
                    if (ct >= sSec) {
                        video.currentTime = iSec;
                        previewState.phase = 2;
                    }
                } else if (previewState.phase === 2) {
                    const endTarget = (Number.isFinite(oSec) && oSec > iSec) ? oSec : iSec + 3;
                    if (ct >= endTarget) {
                        video.currentTime = sSec;
                        previewState.phase = 3;
                    }
                } else if (previewState.phase === 3) {
                    if (ct >= sSec + 3) {
                        video.pause();
                        endPreview();
                    }
                }
            } else {
                const iSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
                const oSec = Number.isFinite(log.outSec) ? log.outSec : parseTC(log.tcout);
                const endTarget = (Number.isFinite(oSec) && oSec > iSec) ? oSec + 3 : iSec + 3;
                if (ct >= endTarget) {
                    video.pause();
                    endPreview();
                }
            }
        }
    }
});

// -- CSV Import/Export --
const csvImportEl = document.getElementById('csvImport');
if (csvImportEl) {
    csvImportEl.addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const lines = ev.target.result.split('\n');
            const newLogs = [];
            for (let i = 4; i < lines.length; i++) {
                let line = lines[i].trim(); if (!line) continue;
                const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                if (cols.length >= 7) {
                    let action, tcswap, tcin, tcout, script, note;
                    action = cols[1].replace(/^"|"$/g,'').trim();
                    if (action === 'DELTELE') action = 'DELETE';
                    tcswap = cols[2].replace(/^"|"$/g,'').trim();
                    tcin   = cols[3].replace(/^"|"$/g,'').trim();
                    tcout  = cols[4].replace(/^"|"$/g,'').trim();
                    script = cols[5].replace(/^"|"$/g,'').replace(/""/g,'"');
                    note   = cols[6].replace(/^"|"$/g,'').replace(/""/g,'"');
                    newLogs.push({ action, tcswap, tcin, tcout, script, note, inSec: parseTC(tcin), outSec: parseTC(tcout) || null, swapSec: tcswap ? parseTC(tcswap) : null });
                }
            }
            if (newLogs.length > 0) {
                if (confirm(`Found ${newLogs.length} rows. Overwrite current list?`)) {
                    logs = newLogs; renderTable(); drawMarkers(); saveSession();
                }
            } else alert('Invalid or empty CSV!');
        };
        reader.readAsText(file); e.target.value = '';
    });
}

// -- Google Sheets Synchronization --
async function syncToGoogleSheets() {
    if (!logs.length) {
        alert('Danh sách log rỗng! Không có gì để đồng bộ.');
        return;
    }

    const btn = document.getElementById('btnSyncSheets');
    const originalText = btn ? btn.innerText : 'Sync Sheets';
    if (btn) {
        btn.innerText = 'Syncing...';
        btn.disabled = true;
    }

    try {
        if (isTokenValid()) {
            // --- PHƯƠNG ÁN 2: ĐỒNG BỘ TRỰC TIẾP QUA GOOGLE REST APIs ---
            const sheetId = currentSpreadsheetId || TEMPLATE_SPREADSHEET_ID;
            
            // 1. Dọn dẹp hàng cũ từ dòng 5 trở đi
            const sheetsClearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Full-show!A5:F:clear`;
            const clearRes = await fetch(sheetsClearUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`
                }
            });
            
            if (!clearRes.ok) {
                const errTxt = await clearRes.text();
                throw new Error('Không thể dọn dẹp hàng cũ trên Sheet: ' + errTxt);
            }
            
            // 2. Ghi đè dữ liệu mới
            const values = logs.map(log => [
                "",
                log.action,
                log.tcin,
                log.tcout,
                log.script,
                log.note
            ]);
            
            const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Full-show!A5:F?valueInputOption=USER_ENTERED`;
            const writeRes = await fetch(writeUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    range: "Full-show!A5:F",
                    majorDimension: "ROWS",
                    values: values
                })
            });
            
            if (!writeRes.ok) {
                const errData = await writeRes.json();
                const errMsg = errData.error ? errData.error.message : 'Không rõ nguyên nhân';
                if (errMsg.includes('violates the data validation rules')) {
                    throw new Error('Vi phạm quy tắc dropdown (Data Validation) trên cột B của Google Sheets. Hãy kiểm tra các lựa chọn trên Sheet!');
                }
                throw new Error('Lỗi ghi dữ liệu: ' + errMsg);
            }
            
            alert('Đồng bộ trực tiếp qua Google REST API thành công! Vui lòng kiểm tra file Google Sheets của bạn.');
            
        } else {
            // --- PHƯƠNG ÁN 1: ĐỒNG BỘ QUA GOOGLE APPS SCRIPT WEB APP ---
            if (!googleSheetsUrl) {
                alert('Vui lòng vào Settings cấu hình Google Sheets Web App URL hoặc đăng nhập Google trước khi đồng bộ!');
                if (mSettings) mSettings.style.display = 'flex';
                return;
            }
            
            const payload = {
                spreadsheetId: currentSpreadsheetId || undefined,
                logs: logs.map(log => ({
                    action: log.action,
                    tcin: log.tcin,
                    tcout: log.tcout,
                    script: log.script,
                    note: log.note
                }))
            };
            
            await fetch(googleSheetsUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });
            
            alert('Yêu cầu đồng bộ đã được gửi thành công! Vui lòng kiểm tra file Google Sheets của bạn.');
        }
    } catch (error) {
        console.error('[AUTOSCRIPT SYNC ERROR]', error);
        alert('Lỗi gửi yêu cầu đồng bộ: ' + error.message);
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

if (btnSyncSheets) {
    btnSyncSheets.addEventListener('click', syncToGoogleSheets);
}

// -- New Project logic removed as it's now handled in project.html --

// ── 23. KEYBOARD SHORTCUTS ─────────────────────────────────
document.addEventListener('keydown', e => {
    if (listeningAction) {
        e.preventDefault();
        if (e.key === 'Escape') { listeningAction = null; renderSettings(); return; }
        if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
        shortcuts[listeningAction] = { key: e.key.toUpperCase(), shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, label: shortcuts[listeningAction].label };
        localStorage.setItem('autoscript_shortcuts', JSON.stringify(shortcuts));
        listeningAction = null; renderSettings();
        return;
    }
    if (e.key === 'Escape' || e.code === 'Space') {
        if (previewState.active) endPreview();
    }
    if (e.key === 'Escape') {
        if (editingRowIndex !== null) saveEdit();
    }
    if (mSettings.style.display === 'flex') {
        if (e.key === 'Escape') mSettings.style.display = 'none';
        return;
    }
    const tcJumpOverlay = document.getElementById('tcJumpOverlay');
    if (tcJumpOverlay && tcJumpOverlay.style.display === 'flex') {
        if (e.key === 'Enter') { e.preventDefault(); executeTimecodeJump(); return; }
        if (e.key === 'Escape') { e.preventDefault(); hideTimecodeJump(); return; }
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    
    if (matchShortcut(e, 'zoom1x')) {
        e.preventDefault();
        applyZoom(1);
        return;
    }
    if (matchShortcut(e, 'zoomOut')) {
        e.preventDefault();
        applyZoom(Math.max(1, timelineZoom - 5));
        return;
    }
    if (matchShortcut(e, 'zoomIn')) {
        e.preventDefault();
        applyZoom(Math.min(50, timelineZoom + 5));
        return;
    }

    const active = document.activeElement;
    const typing = ['INPUT','TEXTAREA','SELECT'].includes(active.tagName) || active.isContentEditable;
    if (e.key === 'Escape') { active.blur(); return; }

    // Always allow Save shortcut even when typing
    if (matchShortcut(e, 'save')) { e.preventDefault(); saveLog(); return; }

    if (typing) return;

    if (matchShortcut(e, 'play')) { e.preventDefault(); togglePlayback(); }
    else if (matchShortcut(e, 'tcin'))       { e.preventDefault(); markInPoint(); }
    else if (matchShortcut(e, 'tcout'))      { e.preventDefault(); markOutPoint(); }
    else if (matchShortcut(e, 'tcswap'))     { e.preventDefault(); markSwapPoint(); }
    else if (matchShortcut(e, 'prev'))       { e.preventDefault(); jumpMarker(-1); }
    else if (matchShortcut(e, 'next'))       { e.preventDefault(); jumpMarker(1); }
    else if (matchShortcut(e, 'jumpin'))     { e.preventDefault(); if (activeInSec !== null) video.currentTime = activeInSec; }
    else if (matchShortcut(e, 'jumpout'))    { e.preventDefault(); if (activeOutSec !== null) video.currentTime = activeOutSec; }
    else if (matchShortcut(e, 'slow'))       { e.preventDefault(); playbackSpeed = Math.max(0.25, playbackSpeed - 0.25); video.playbackRate = playbackSpeed; speedDisplay.innerText = playbackSpeed.toFixed(2) + 'x'; }
    else if (matchShortcut(e, 'fast'))       { e.preventDefault(); playbackSpeed = Math.min(10, playbackSpeed + 0.25); video.playbackRate = playbackSpeed; speedDisplay.innerText = playbackSpeed.toFixed(2) + 'x'; }
    else if (matchShortcut(e, 'previewCut')) { e.preventDefault(); togglePreviewCut(); }
    else if (matchShortcut(e, 'script'))     { e.preventDefault(); document.getElementById('inputScript').focus(); }
    else if (matchShortcut(e, 'note'))       { e.preventDefault(); document.getElementById('inputNote').focus(); }
    else if (matchShortcut(e, 'action'))     { e.preventDefault(); let idx = actionList.indexOf(selectedAction); idx = (Math.max(0, idx) + 1) % actionList.length; setSelectedAction(actionList[idx]); }
    else if (matchShortcut(e, 'video'))      { e.preventDefault(); upload.click(); }
    else if (e.code === 'ArrowRight')        { e.preventDefault(); skipTime(5); }
    else if (e.code === 'ArrowLeft')         { e.preventDefault(); skipTime(-5); }
});

function saveEdit() {
    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        const log = logs[editingRowIndex];
        // Sync workspace textarea values back into the log
        const scriptEl = document.getElementById('inputScript');
        const noteEl = document.getElementById('inputNote');
        if (scriptEl) log.script = scriptEl.value.trim();
        if (noteEl)   log.note   = noteEl.value.trim();
        // Recalculate formatted TC from seconds
        log.tcin  = formatTC(log.inSec);
        log.tcout = log.outSec ? formatTC(log.outSec) : '00:00:00:00';
        log.tcswap = log.swapSec ? formatTC(log.swapSec) : '';
    }
    editingRowIndex = null;
    // Clear workspace
    activeInSec = null; activeOutSec = null; activeSwapSec = null;
    valTcIn.innerText = '00:00:00:00';
    valTcOut.innerText = '00:00:00:00';
    if (valTcSwap) valTcSwap.innerText = '00:00:00:00';
    document.getElementById('inputScript').value = '';
    document.getElementById('inputNote').value = '';
    updateActiveRange();
    boxIn.classList.remove('active');
    boxOut.classList.remove('active');
    if (boxSwap) boxSwap.classList.remove('active');
    saveSession();
    renderTable();
    drawMarkers();
}

function hideContextMenu() {
    const menu = document.getElementById('rowContextMenu');
    if (menu) menu.style.display = 'none';
}

window.showRowMenu = function(e, index) {
    e.preventDefault();
    menuTargetIndex = index;
    const menu = document.getElementById('rowContextMenu');
    if (menu) {
        menu.style.display = 'flex';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
    }
};

const menuEdit = document.getElementById('menuEdit');
if (menuEdit) menuEdit.addEventListener('click', () => {
    // If already editing another row, save it first
    if (editingRowIndex !== null && editingRowIndex !== menuTargetIndex) {
        saveEdit();
    }
    editingRowIndex = menuTargetIndex;
    
    // Mirror all data to workspace
    const log = logs[editingRowIndex];
    if (!log) { editingRowIndex = null; return; }
    
    activeInSec = log.inSec;
    activeOutSec = log.outSec;
    activeSwapSec = log.swapSec;
    
    valTcIn.innerText = formatTC(activeInSec);
    valTcOut.innerText = activeOutSec != null ? formatTC(activeOutSec) : '00:00:00:00';
    if (valTcSwap) valTcSwap.innerText = activeSwapSec != null ? formatTC(activeSwapSec) : '00:00:00:00';
    
    document.getElementById('inputScript').value = log.script || '';
    document.getElementById('inputNote').value = log.note || '';
    
    // Update action selection to match the editing row
    selectedAction = log.action;
    updateActionButtons();
    if (boxSwap) boxSwap.style.display = log.action === 'SWAP' ? 'block' : 'none';
    
    // Update TC box active states
    if (activeInSec != null) boxIn.classList.add('active'); else boxIn.classList.remove('active');
    if (activeOutSec != null) boxOut.classList.add('active'); else boxOut.classList.remove('active');
    if (boxSwap) {
        if (activeSwapSec != null) boxSwap.classList.add('active'); else boxSwap.classList.remove('active');
    }
    updateActiveRange();
    
    renderTable();
    hideContextMenu();
});

const menuDelete = document.getElementById('menuDelete');
if (menuDelete) menuDelete.addEventListener('click', () => {
    deleteLog(menuTargetIndex);
    hideContextMenu();
});

// ── 24. INITIALIZATION ─────────────────────────────────────
updateActionButtons();
updateToolbarPlayState();

// Zoom / Timeline logic initialization ...
let timelineZoom = 1;
const btnZoomDrag = document.getElementById('btnZoomDrag');
const zoomMenu = document.getElementById('zoomMenu');
function applyZoom(newZoom) {
    if (newZoom < 1) newZoom = 1;
    if (newZoom > 50) newZoom = 50;

    const wrapper = document.querySelector('.custom-timeline-wrapper');
    const timeline = document.getElementById('customTimeline');

    timelineZoom = newZoom;
    timeline.style.width = (timelineZoom * 100) + '%';
    timeline.style.minWidth = (timelineZoom * 100) + '%';

    // Center playhead after zoom
    if (video.duration) {
        const playheadX = (video.currentTime / video.duration) * timeline.offsetWidth;
        wrapper.scrollLeft = playheadX - (wrapper.offsetWidth / 2);
    }

    const zoomText = document.getElementById('zoomText');
    const btnZoomDrag = document.getElementById('btnZoomDrag');
    if (zoomText) {
        zoomText.innerText = timelineZoom.toFixed(2) + 'x';
    }
    if (btnZoomDrag) {
        if (timelineZoom > 1) {
            btnZoomDrag.style.color = '#60a5fa';
            btnZoomDrag.style.textShadow = '0 0 8px rgba(96,165,250,0.5)';
        } else {
            btnZoomDrag.style.color = '';
            btnZoomDrag.style.textShadow = '';
        }
    }
    drawMarkers();
    renderTimelineTicks();
}

timelineWrapper.addEventListener('wheel', (e) => {
    if (!video.duration) return;
    if (e.deltaY === 0) return;
    
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.05;
    let newZoom = Math.max(1, Math.min(50, timelineZoom + zoomDelta));
    if (newZoom === timelineZoom) return;
    
    applyZoom(newZoom);
}, { passive: false });

if (btnZoomDrag) {
    let isZoomDragging = false;
    let startX = 0;
    let startZoom = 1;

    btnZoomDrag.addEventListener('mousedown', (e) => {
        isZoomDragging = false;
        startX = e.clientX;
        startZoom = timelineZoom;
        
        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            if (Math.abs(dx) > 3) {
                isZoomDragging = true;
                let z = startZoom + Math.round(dx / 10) * 1;
                applyZoom(z);
            }
        }
        function onMouseUp(ev) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!isZoomDragging) {
                if (timelineZoom !== 1) {
                    applyZoom(1);
                } else {
                    zoomMenu.style.display = zoomMenu.style.display === 'block' ? 'none' : 'block';
                }
            }
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function renderTimelineTicks() {
    const ticksContainer = document.getElementById('timelineTicks');
    if (!ticksContainer || !video.duration) return;
    ticksContainer.innerHTML = '';
    const duration = video.duration;
    
    // We want roughly 10-12 ticks visible in the current viewport
    const visibleDuration = duration / timelineZoom;
    const targetStep = visibleDuration / 10;
    
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
    let step = steps[steps.length - 1];
    for (let s of steps) {
        if (s >= targetStep) {
            step = s;
            break;
        }
    }

    for (let t = 0; t <= duration; t += step) {
        const pct = (t / duration) * 100;
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = pct + '%';
        tick.style.top = '0';
        tick.style.height = '100%';
        tick.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
        
        const label = document.createElement('div');
        let labelText = '';
        if (t > 0) {
            const h = Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            const s = Math.floor(t % 60);
            if (h > 0) labelText += h + 'h';
            if (m > 0 || (h > 0 && s > 0)) labelText += m + 'm';
            if (s > 0) labelText += s + 's';
        }
        label.innerText = labelText;
        
        label.style.position = 'absolute';
        label.style.top = '28px'; // Moved below the timeline
        label.style.left = '-10px';
        label.style.fontSize = '9px';
        label.style.color = 'var(--text-muted)';
        label.style.pointerEvents = 'none';
        
        tick.appendChild(label);
        ticksContainer.appendChild(tick);
    }
}

// (Duplicate loadedmetadata removed — merged into main listener above)

// IndexedDB for Video Storage
const dbName = 'AutoscriptDB';
window.db = null;
const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = (e) => {
    window.db = e.target.result;
    if (!window.db.objectStoreNames.contains('videoStore')) {
        window.db.createObjectStore('videoStore');
    }
};
request.onsuccess = (e) => {
    window.db = e.target.result;
    if (window.db.objectStoreNames.contains('videoStore')) {
        const tx = window.db.transaction('videoStore', 'readonly');
        const req = tx.objectStore('videoStore').get('lastVideo');
        req.onsuccess = () => {
            if (req.result) {
                if (video.src && video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
                video.src = URL.createObjectURL(req.result);
                const ut = document.getElementById('uploadText');
                if (ut) ut.innerText = req.result.name;
            }
        };
    }
};
renderSettings();
renderTable();
updateActiveSheetUI();
updateGoogleUI();
initGoogleOAuth();
setTimeout(drawMarkers, 300);
console.log('[AUTOSCRIPT] ✓ Initialized successfully');

