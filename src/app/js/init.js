// ============================================================
//  AUTOSCRIPT TCP Pro — init.js
//  Bootstrap: DOM refs, event listeners, initial data load.
//  Must be loaded LAST after all other modules.
// ============================================================

// ── Debug Error Catcher ───────────────────────────────────────
window.__jsErrors = [];
window.onerror = function(msg, src, line) {
    window.__jsErrors.push(msg + ' @ ' + src + ':' + line);
    console.error('[AUTOSCRIPT ERROR]', msg, '@', src, ':', line);
};

// ── Read URL Params → Project Identity ───────────────────────
(function applyUrlParams() {
    const urlParams  = new URLSearchParams(window.location.search);
    const urlSheetId   = urlParams.get('sheetId');
    const urlSheetName = urlParams.get('sheetName');
    const urlSheetUrl  = urlParams.get('sheetUrl');
    const pathSheetId  = getSpreadsheetIdFromPath();
    const resolvedSheetId = urlSheetId || pathSheetId;
    if (resolvedSheetId) {
        currentSpreadsheetId   = resolvedSheetId;
        currentSpreadsheetUrl  = urlSheetUrl  || `https://docs.google.com/spreadsheets/d/${resolvedSheetId}/edit`;
        currentSpreadsheetName = urlSheetName || 'Google Sheet';
        currentProjectVideoMeta = getCachedProjectVideoMeta(resolvedSheetId);
        localStorage.setItem('autoscript_current_spreadsheet_id',   currentSpreadsheetId);
        localStorage.setItem('autoscript_current_spreadsheet_url',  currentSpreadsheetUrl);
        localStorage.setItem('autoscript_current_spreadsheet_name', currentSpreadsheetName);
    }
})();

// ── Legacy OAuth stubs ────────────────────────────────────────
function isTokenValid() { return true; }
function updateGoogleUI() {} // legacy stub – overridden below
window.initGoogleOAuth = function() {};
function handleGoogleAuthClick() {}

// ── Resizer ───────────────────────────────────────────────────
(function initResizers() {
    const mainContainer = document.getElementById('mainContainer');
    const leftCol       = document.getElementById('leftCol');
    const rightCol      = document.getElementById('tablePanel');
    const resizerV      = document.getElementById('resizerV');
    const resizerH1     = document.getElementById('resizerH1');
    const resizerH2     = document.getElementById('resizerH2');
    const videoSection  = document.getElementById('videoSection');
    const formSection   = document.getElementById('formSection');
    const floatPanel    = document.getElementById('floatHelpPanel');
    const floatHeader   = document.getElementById('floatHelpHeader');

    if (resizerV)  resizerV.addEventListener('mousedown',  e => { isResizingV  = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
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
            if (topH > 100 && topH < rect.height - 250) { videoSection.style.height = topH + 'px'; videoSection.style.flex = 'none'; }
        }
        if (isResizingH2) {
            const rect = leftCol.getBoundingClientRect();
            const formH = rect.bottom - e.clientY;
            if (formH > 100 && formH < rect.height - 250) { formSection.style.height = formH + 'px'; formSection.style.flex = 'none'; }
        }
        if (isDraggingFloat && floatPanel) {
            floatPanel.style.left = (e.clientX - floatOffsetX) + 'px';
            floatPanel.style.top  = (e.clientY - floatOffsetY) + 'px';
        }
        if (isDraggingSpeed) {
            const dx = e.clientX - speedStartX;
            if (Math.abs(dx) > 3) speedDidDrag = true;
            const video = document.getElementById('videoPlayer');
            const speedDisplay = document.getElementById('speedDisplay');
            const newSpeed = Math.max(0.25, Math.min(speedStartVal + Math.round(dx / 10) * 0.25, 10.0));
            if (Math.abs(newSpeed - playbackSpeed) > 0.05) {
                playbackSpeed = newSpeed;
                if (video) video.playbackRate = playbackSpeed;
                if (speedDisplay) speedDisplay.innerText = playbackSpeed.toFixed(2) + 'x';
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isResizingV = false; isResizingH1 = false; isResizingH2 = false;
        isDraggingFloat = false; isDraggingSpeed = false;
        document.body.style.cursor = 'default';
    });

    // Float panel drag
    if (floatHeader && floatPanel) {
        floatHeader.addEventListener('mousedown', e => {
            isDraggingFloat = true;
            floatOffsetX = e.clientX - floatPanel.offsetLeft;
            floatOffsetY = e.clientY - floatPanel.offsetTop;
            document.body.style.cursor = 'move';
        });
    }
})();

// ── Float Help Panel ──────────────────────────────────────────
document.getElementById('btnHelp').onclick = () => {
    const fp = document.getElementById('floatHelpPanel');
    if (fp) fp.style.display = fp.style.display === 'flex' ? 'none' : 'flex';
};
document.getElementById('btnCloseHelp').onclick = () => {
    const fp = document.getElementById('floatHelpPanel');
    if (fp) fp.style.display = 'none';
};

// ── Settings Modal ────────────────────────────────────────────
document.getElementById('btnShortcuts').onclick   = () => { document.getElementById('settingsModal').style.display = 'flex'; };
document.getElementById('btnCloseSettings').onclick = () => { document.getElementById('settingsModal').style.display = 'none'; };

// ── TC Box Clicks ─────────────────────────────────────────────
(function bindTCBoxes() {
    const boxIn   = document.getElementById('boxIn');
    const boxOut  = document.getElementById('boxOut');
    const boxSwap = document.getElementById('boxSwap');

    if (boxIn) boxIn.addEventListener('click', markInPoint);
    if (boxOut) boxOut.addEventListener('click', markOutPoint);
    if (boxSwap) boxSwap.addEventListener('click', markSwapPoint);
})();

// ── Theme Select ──────────────────────────────────────────────
document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

// ── Preset Select (Moved to custom menu in playback.js) ────────

// ── Export Select ─────────────────────────────────────────────
const exportSelect = document.getElementById('exportSelect');
if (exportSelect) {
    exportSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        
        if (typeof window.handleExport === 'function') {
            window.handleExport(val);
        } else {
            console.warn("Export functionality not loaded yet.");
        }
        
        // Reset select back to placeholder
        e.target.value = '';
    });
}

// ── FPS Select ────────────────────────────────────────────────
const fpsSelect = document.getElementById('fpsSelect');
if (fpsSelect) {
    fpsSelect.addEventListener('change', (e) => {
        FPS = parseFloat(e.target.value);
        const video = document.getElementById('videoPlayer');
        if (video && video.duration) {
            document.getElementById('tcEnd').innerText = formatBoundTC(video.duration);
            document.getElementById('bigTimecode').innerText = formatTC(video.currentTime);
            renderTable(); drawMarkers(); renderTimelineTicks();
        }
    });
}

// ── Action Buttons ────────────────────────────────────────────
document.querySelectorAll('#actionButtonGroup .action-button').forEach(btn =>
    btn.addEventListener('click', () => setSelectedAction(btn.dataset.action))
);

// ── Video Upload ──────────────────────────────────────────────
const upload = document.getElementById('videoUpload');
if (upload) {
    upload.addEventListener('change', e => {
        if (!e.target.files[0]) return;
        const selectedFile = e.target.files[0];
        const video = document.getElementById('videoPlayer');
        if (video.src && video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
        video.src = URL.createObjectURL(selectedFile);
        document.getElementById('uploadText').innerText = selectedFile.name;
        pendingVideoMeta = {
            fileName: selectedFile.name, fileSize: selectedFile.size,
            fileType: selectedFile.type, lastModified: selectedFile.lastModified,
            durationSec: 0, updatedAt: new Date().toISOString()
        };
        persistProjectVideoMeta(pendingVideoMeta);
    });
}

// ── Video Events ──────────────────────────────────────────────
(function bindVideoEvents() {
    const video = document.getElementById('videoPlayer');
    if (!video) return;

    video.addEventListener('loadedmetadata', () => {
        document.getElementById('tcStart').innerText = '00:00';
        document.getElementById('tcEnd').innerText   = formatBoundTC(video.duration);
        drawMarkers(); renderTimelineTicks();
        if (pendingVideoMeta) {
            pendingVideoMeta.durationSec = video.duration || 0;
            pendingVideoMeta.updatedAt   = new Date().toISOString();
            persistProjectVideoMeta(pendingVideoMeta);
            pendingVideoMeta = null;
        }
    });

    document.getElementById('tcStart').addEventListener('click', () => { video.currentTime = 0; });
    document.getElementById('tcEnd').addEventListener('click',   () => { if (video.duration) video.currentTime = video.duration; });
    video.addEventListener('focus', () => video.blur());

    // Play/pause
    const btnPlayVideo   = document.getElementById('btnPlayVideo');
    const btnPlayReverse = document.getElementById('btnPlayReverse');

    if (btnPlayVideo) {
        btnPlayVideo.addEventListener('click', () => {
            if (reverseInterval) { clearInterval(reverseInterval); reverseInterval = null; if (btnPlayReverse) btnPlayReverse.classList.remove('active'); }
            togglePlayback();
        });
    }
    video.addEventListener('play',  () => { updateToolbarPlayState(); if (tcAutoSelected) clearAutoSelectedTC(); });
    video.addEventListener('pause', updateToolbarPlayState);
    video.addEventListener('seeked', () => {
        if (tcJumpWait) { tcJumpWait = false; }
        else if (tcAutoSelected) { clearAutoSelectedTC(); }
    });

    // Play Reverse
    if (btnPlayReverse) {
        btnPlayReverse.addEventListener('click', () => {
            if (!video.paused) video.pause();
            if (reverseInterval) {
                clearInterval(reverseInterval); reverseInterval = null;
                btnPlayReverse.classList.remove('active'); updateToolbarPlayState();
            } else {
                reverseInterval = setInterval(() => {
                    if (video.currentTime <= 0.05) {
                        clearInterval(reverseInterval); reverseInterval = null;
                        btnPlayReverse.classList.remove('active');
                        video.currentTime = 0; updateToolbarPlayState();
                    } else { video.currentTime -= 0.05; }
                }, 50);
                btnPlayReverse.classList.add('active'); updateToolbarPlayState();
            }
        });
    }

    // Big timecode
    const bigTc = document.getElementById('bigTimecode');
    if (bigTc) {
        bigTc.addEventListener('click', function() {
            navigator.clipboard.writeText(this.innerText);
            this.style.color = 'var(--success)';
            setTimeout(() => { this.style.color = 'var(--accent)'; }, 500);
        });
        bigTc.addEventListener('dblclick', function(e) { e.preventDefault(); showTimecodeJump(); });
    }

    // Speed control
    const speedDisplay = document.getElementById('speedDisplay');
    if (speedDisplay) {
        speedDisplay.addEventListener('mousedown', e => {
            isDraggingSpeed = true; speedDidDrag = false;
            speedStartX = e.clientX; speedStartVal = playbackSpeed;
            document.body.style.cursor = 'ew-resize'; e.preventDefault();
        });
        speedDisplay.addEventListener('click', e => {
            if (speedDidDrag) return;
            e.stopPropagation();
            playbackSpeed = 1; video.playbackRate = 1;
            speedDisplay.innerText = '1.00x';
        });
    }

    // Volume
    const volSlider = document.getElementById('volumeSlider');
    if (volSlider) volSlider.addEventListener('input', e => { video.volume = e.target.value; });

    // Preview cut
    const btnPreviewCut = document.getElementById('btnPreviewCut');
    if (btnPreviewCut) btnPreviewCut.addEventListener('click', togglePreviewCut);

    // Time update loop
    video.addEventListener('timeupdate', () => {
        const ct = video.currentTime;
        if (!video.duration) return;
        const pct     = (ct / video.duration) * 100;
        const progress = document.getElementById('timelineProgress');
        const playhead = document.getElementById('playheadIndicator');
        if (progress) progress.style.width = pct + '%';
        if (playhead) playhead.style.left  = pct + '%';
        if (bigTc) bigTc.innerText = formatTC(ct);

        const valTcIn  = document.getElementById('valTcIn');
        const valTcOut = document.getElementById('valTcOut');
        const valTcSwap = document.getElementById('valTcSwap');
        if (activeInSec   === null && valTcIn)  valTcIn.innerText  = formatTC(ct);
        if (activeOutSec  === null && valTcOut)  valTcOut.innerText = formatTC(ct);
        if (activeSwapSec === null && valTcSwap) valTcSwap.innerText = formatTC(ct);

        let activeColor = 'var(--text-main)';
        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const end = log.outSec ? log.outSec : log.inSec + 1;
            const row = document.getElementById('row-' + i);
            if (ct >= log.inSec - 0.05 && ct < end) {
                const colorSet = actionColors[log.action] || { bg: '#1e293b', color: '#e2e8f0' };
                activeColor = colorSet.bg;
                if (row) row.classList.add('highlight-playing');
            } else {
                if (row) row.classList.remove('highlight-playing');
            }
        }
        if (bigTc) bigTc.style.color = activeColor;

        if (activeInSec !== null && activeOutSec === null) updateActiveRange();

        // Preview Cut skip
        if (isPreviewCut) {
            const isReversing = reverseInterval !== null;
            for (let i = 0; i < logs.length; i++) {
                if (logs[i].action === 'DELETE' && logs[i].outSec) {
                    if (ct >= logs[i].inSec && ct < logs[i].outSec) {
                        video.currentTime = isReversing ? logs[i].inSec - 0.05 : logs[i].outSec;
                        break;
                    }
                }
            }
        }

        // Preview state machine
        if (previewState && previewState.active) {
            const log = logs[previewState.logIndex];
            if (log) {
                if (log.action === 'SWAP') {
                    const sSec = Number.isFinite(log.swapSec) ? log.swapSec : parseTC(log.tcswap);
                    const iSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
                    const oSec = Number.isFinite(log.outSec) ? log.outSec : parseTC(log.tcout);
                    if (previewState.phase === 1) { if (ct >= sSec) { video.currentTime = iSec; previewState.phase = 2; } }
                    else if (previewState.phase === 2) {
                        const endTarget = (Number.isFinite(oSec) && oSec > iSec) ? oSec : iSec + 3;
                        if (ct >= endTarget) { video.currentTime = sSec; previewState.phase = 3; }
                    } else if (previewState.phase === 3) {
                        if (ct >= sSec + 3) { video.pause(); endPreview(); }
                    }
                } else {
                    const iSec = Number.isFinite(log.inSec) ? log.inSec : parseTC(log.tcin);
                    const oSec = Number.isFinite(log.outSec) ? log.outSec : parseTC(log.tcout);
                    const endTarget = (Number.isFinite(oSec) && oSec > iSec) ? oSec + 3 : iSec + 3;
                    if (ct >= endTarget) { video.pause(); endPreview(); }
                }
            }
        }
    });
})();

// ── TC Jump Overlay ───────────────────────────────────────────
document.getElementById('tcJumpGo').addEventListener('click',    executeTimecodeJump);
document.getElementById('tcJumpClose').addEventListener('click', hideTimecodeJump);

// ── Import Button ─────────────────────────────────────────────
const btnToolbarImport = document.getElementById('btnToolbarImport');
if (btnToolbarImport) btnToolbarImport.addEventListener('click', saveLog);

const btnCaptureFrame = document.getElementById('btnCaptureFrame');
if (btnCaptureFrame) btnCaptureFrame.addEventListener('click', () => { if(window.captureVideoFrame) window.captureVideoFrame(); });

const btnToggleView = document.getElementById('btnToggleView');
if (btnToggleView) {
    btnToggleView.addEventListener('click', () => {
        isStoryboardView = !isStoryboardView;
        renderTable();
    });
}

// ── Sync Sheets ───────────────────────────────────────────────
const btnSyncSheets = document.getElementById('btnSyncSheets');
if (btnSyncSheets) btnSyncSheets.addEventListener('click', syncToGoogleSheets);

// ── Message Modal Close ───────────────────────────────────────
const btnCloseMsg = document.getElementById('btnCloseMessageModal');
if (btnCloseMsg) btnCloseMsg.addEventListener('click', closeMessageModal);
const mMessage = document.getElementById('messageModal');
if (mMessage) mMessage.addEventListener('click', e => { if (e.target === mMessage) closeMessageModal(); });

// ── Global Mousedown (context menu + edit exit) ───────────────
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tc-jump-overlay')) return;
    const menu = document.getElementById('rowContextMenu');
    if (menu && !e.target.closest('#rowContextMenu')) menu.style.display = 'none';

    if (editingRowIndex !== null) {
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row && row.contains(e.target)) return;
        if (e.target.closest('.context-menu'))              return;
        if (e.target.closest('.form-section'))              return;
        if (e.target.closest('.tc-row'))                    return;
        if (e.target.closest('.action-button-group'))       return;
        if (e.target.closest('.action-button'))             return;
        if (e.target.closest('#btnToolbarImport'))          return;
        if (e.target.closest('#btnToolbarImportShort'))     return;
        if (e.target.closest('.custom-timeline-wrapper'))   return;
        if (e.target.closest('#boxIn') || e.target.closest('#boxOut') || e.target.closest('#boxSwap')) return;
        saveEdit();
    }
});

document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.log-row') && !e.target.closest('.context-menu')) hideContextMenu();
});

// ── Script/Note sync while in edit mode ───────────────────────
document.getElementById('inputScript').addEventListener('input', function(e) {
    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        logs[editingRowIndex].script = e.target.value;
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) { const cells = row.querySelectorAll('td'); if (cells[6]) cells[6].innerText = e.target.value; }
    }
});
document.getElementById('inputNote').addEventListener('input', function(e) {
    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        logs[editingRowIndex].note = e.target.value;
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) { const cells = row.querySelectorAll('td'); if (cells[7]) cells[7].innerText = e.target.value; }
    }
});

// ── Table Filters ─────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
if (searchInput) searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); renderTable(); });
const filterActionSel = document.getElementById('filterAction');
if (filterActionSel) filterActionSel.addEventListener('change', e => { filterQuery = e.target.value; renderTable(); });

// ── Context Menu Actions ──────────────────────────────────────
(function bindContextMenu() {
    const menuEdit   = document.getElementById('menuEdit');
    const menuDelete = document.getElementById('menuDelete');
    const valTcIn    = document.getElementById('valTcIn');
    const valTcOut   = document.getElementById('valTcOut');
    const valTcSwap  = document.getElementById('valTcSwap');
    const boxIn      = document.getElementById('boxIn');
    const boxOut     = document.getElementById('boxOut');
    const boxSwap    = document.getElementById('boxSwap');

    if (menuEdit) menuEdit.addEventListener('click', () => {
        if (editingRowIndex !== null && editingRowIndex !== menuTargetIndex) saveEdit();
        editingRowIndex = menuTargetIndex;
        const log = logs[editingRowIndex];
        if (!log) { editingRowIndex = null; return; }

        activeInSec = log.inSec; activeOutSec = log.outSec; activeSwapSec = log.swapSec;
        if (valTcIn)  valTcIn.innerText  = formatTC(activeInSec);
        if (valTcOut) valTcOut.innerText = activeOutSec  != null ? formatTC(activeOutSec)  : '00:00:00:00';
        if (valTcSwap) valTcSwap.innerText = activeSwapSec != null ? formatTC(activeSwapSec) : '00:00:00:00';
        document.getElementById('inputScript').value = log.script || '';
        document.getElementById('inputNote').value   = log.note   || '';
        selectedAction = log.action; updateActionButtons();
        if (boxSwap) boxSwap.style.display = log.action === 'SWAP' ? 'block' : 'none';
        if (boxIn)  { if (activeInSec  != null) boxIn.classList.add('active');  else boxIn.classList.remove('active'); }
        if (boxOut) { if (activeOutSec != null) boxOut.classList.add('active'); else boxOut.classList.remove('active'); }
        if (boxSwap) { if (activeSwapSec != null) boxSwap.classList.add('active'); else boxSwap.classList.remove('active'); }
        updateActiveRange(); renderTable(); hideContextMenu();
    });

    if (menuDelete) menuDelete.addEventListener('click', () => {
        deleteLog(menuTargetIndex); hideContextMenu();
    });
})();

// ── Keyboard Shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
    const mMessage   = document.getElementById('messageModal');
    const mSettings  = document.getElementById('settingsModal');

    if (mMessage && mMessage.style.display === 'flex' && e.key === 'Escape') {
        e.preventDefault(); closeMessageModal(); return;
    }
    const cModal = document.getElementById('confirmModal');
    if (cModal && cModal.style.display === 'flex' && e.key === 'Escape') {
        e.preventDefault(); document.getElementById('btnConfirmCancel')?.click(); return;
    }
    if (listeningAction) {
        e.preventDefault();
        if (e.key === 'Escape') { listeningAction = null; renderSettings(); return; }
        if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
        shortcuts[listeningAction] = { key: e.key.toUpperCase(), shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, label: shortcuts[listeningAction].label };
        localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcuts));
        listeningAction = null; renderSettings(); return;
    }
    if (e.key === 'Escape' || e.code === 'Space') { if (previewState.active) endPreview(); }
    if (e.key === 'Escape') { if (editingRowIndex !== null) saveEdit(); }
    if (mSettings && mSettings.style.display === 'flex') {
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

    const active = document.activeElement;
    const isTypingInput = active.tagName === 'INPUT' && !['button','checkbox','radio','range','submit','reset','color'].includes(active.type);
    const typing = isTypingInput || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable;
    if (e.key === 'Escape') { active.blur(); return; }

    if (matchShortcut(e, 'save')) { e.preventDefault(); saveLog(); return; }
    if (typing) return;

    if (matchShortcut(e, 'zoom1x'))   { e.preventDefault(); applyZoom(1); return; }
    if (matchShortcut(e, 'zoomOut'))  { e.preventDefault(); applyZoom(Math.max(1, timelineZoom - 5)); return; }
    if (matchShortcut(e, 'zoomIn'))   { e.preventDefault(); applyZoom(Math.min(50, timelineZoom + 5)); return; }

    if      (matchShortcut(e, 'play'))       { e.preventDefault(); togglePlayback(); }
    else if (matchShortcut(e, 'tcin'))       { e.preventDefault(); markInPoint(); }
    else if (matchShortcut(e, 'tcout'))      { e.preventDefault(); markOutPoint(); }
    else if (matchShortcut(e, 'tcswap'))     { e.preventDefault(); markSwapPoint(); }
    else if (matchShortcut(e, 'prev'))       { e.preventDefault(); jumpMarker(-1); }
    else if (matchShortcut(e, 'next'))       { e.preventDefault(); jumpMarker(1); }
    else if (matchShortcut(e, 'jumpin'))     { e.preventDefault(); const v = document.getElementById('videoPlayer'); if (activeInSec !== null && v) v.currentTime = activeInSec; }
    else if (matchShortcut(e, 'jumpout'))    { e.preventDefault(); const v = document.getElementById('videoPlayer'); if (activeOutSec !== null && v) v.currentTime = activeOutSec; }
    else if (matchShortcut(e, 'slow'))       { e.preventDefault(); const s = document.getElementById('speedDisplay'); const v = document.getElementById('videoPlayer'); playbackSpeed = Math.max(0.25, playbackSpeed - 0.25); if (v) v.playbackRate = playbackSpeed; if (s) s.innerText = playbackSpeed.toFixed(2) + 'x'; }
    else if (matchShortcut(e, 'fast'))       { e.preventDefault(); const s = document.getElementById('speedDisplay'); const v = document.getElementById('videoPlayer'); playbackSpeed = Math.min(10, playbackSpeed + 0.25); if (v) v.playbackRate = playbackSpeed; if (s) s.innerText = playbackSpeed.toFixed(2) + 'x'; }
    else if (matchShortcut(e, 'previewCut')){ e.preventDefault(); togglePreviewCut(); }
    else if (matchShortcut(e, 'script'))     { e.preventDefault(); document.getElementById('inputScript').focus(); }
    else if (matchShortcut(e, 'note'))       { e.preventDefault(); document.getElementById('inputNote').focus(); }
    else if (matchShortcut(e, 'action'))     { e.preventDefault(); let idx = actionList.indexOf(selectedAction); idx = (Math.max(0, idx) + 1) % actionList.length; setSelectedAction(actionList[idx]); }
    else if (matchShortcut(e, 'video'))      { e.preventDefault(); const u = document.getElementById('videoUpload'); if (u) u.click(); }
    else if (e.code === 'ArrowRight')        { e.preventDefault(); skipTime(5); }
    else if (e.code === 'ArrowLeft')         { e.preventDefault(); skipTime(-5); }
});

// ── Init Sub-Systems ──────────────────────────────────────────
initZoomDragButton();
initTimelinePan();
initTimelineWheel();
initTimelineScrub();
initCSVImport();

updateActionButtons();
updateToolbarPlayState();

// ── Override renderSheetTabs to also update menus ─────────────
const _origRenderSheetTabs = renderSheetTabs;
renderSheetTabs = function() {
    _origRenderSheetTabs();
    buildImportShortMenu();
    updateImportShortVisibility();
};
buildImportShortMenu();
updateImportShortVisibility();

// ── Override updateGoogleUI to load sheet tabs after auth ──────
window.updateGoogleUI = function() {
    if (isTokenValid()) loadSheetTabsFromGoogle();
};

// ── Bootstrap Sequence ────────────────────────────────────────
renderSettings();
resolveCurrentSpreadsheetMeta().finally(() => {
    loadProjectLogsFromKV().finally(() => {
        renderTable();
        updateActiveSheetUI();
        renderProjectVideoMeta();
        updateGoogleUI();
        initGoogleOAuth();
        setTimeout(drawMarkers, 300);
        console.log('[AUTOSCRIPT] ✓ Initialized successfully');
    });
});
