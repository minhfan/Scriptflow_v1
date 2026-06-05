// ============================================================
//  AUTOSCRIPT TCP Pro — tabs.js
//  Sheet tab switching, sendLogToTargetTab, buildRowSendMenu,
//  importShortMenu, updateImportShortVisibility.
//  Depends on: state.js, api.js, renderer.js, modals.js
// ============================================================

// ── Switch Tab ────────────────────────────────────────────────
function switchSheetTab(tabName) {
    if (currentSheetTab === tabName) return;

    // Flush pending save for current tab
    if (projectLogsSaveTimer) {
        clearTimeout(projectLogsSaveTimer);
        projectLogsSaveTimer = null;
    }

    // Snapshot current tab to cache
    tabLogsCache[currentSheetTab] = JSON.parse(JSON.stringify(logs));
    if (isLogsDirty) {
        saveProjectLogsToKV(currentSheetTab, tabLogsCache[currentSheetTab]);
        isLogsDirty = false;
    }

    currentSheetTab = tabName;
    renderSheetTabs();

    if (tabLogsCache[tabName] !== undefined) {
        // Already in cache → instant
        logs = JSON.parse(JSON.stringify(tabLogsCache[tabName]));
        renderTable();
        updateTimeline();
    } else {
        // Not in cache → load from KV
        logs = [];
        renderTable();
        updateTimeline();
        loadProjectLogsFromKV(tabName).then((loaded) => {
            if (!loaded) return;
            renderTable();
            updateTimeline();
        });
    }
    updateImportShortVisibility();
}

// ── Send Log to Another Tab ───────────────────────────────────
async function sendLogToTargetTab(targetTab, logData, chipEl) {
    if (!targetTab || !logData) return false;
    if (chipEl) { chipEl.classList.add('sending'); chipEl.innerText = '...'; }
    try {
        if (!tabLogsCache[targetTab]) {
            try {
                const res = await fetch(
                    `/tcpscript/api/project-logs?id=${encodeURIComponent(currentSpreadsheetId)}&tab=${encodeURIComponent(targetTab)}&t=${Date.now()}`,
                    { headers: { 'Authorization': `Bearer ${sessionToken}` } }
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                tabLogsCache[targetTab] = Array.isArray(data.logs) ? data.logs : [];
            } catch (err) {
                console.warn('[TABS] Failed to fetch target tab:', err);
                throw new Error(`Không thể tải dữ liệu của tab "${targetTab}" trước khi gửi.`);
            }
        }
        tabLogsCache[targetTab].push(JSON.parse(JSON.stringify(logData)));
        await saveProjectLogsToKV(targetTab, tabLogsCache[targetTab]);
        return true;
    } catch (e) {
        console.error('[TABS] sendLogToTargetTab failed:', e);
        openMessageModal('Lỗi', 'Chuyển thất bại: ' + e.message);
        return false;
    } finally {
        if (chipEl && !chipEl.classList.contains('sent')) {
            chipEl.classList.remove('sending');
            chipEl.innerText = targetTab;
        }
    }
}

// ── Row SEND floating menu ────────────────────────────────────
let _activeRowMenu = null;

window.buildRowSendMenu = function(wrapperEl, logIndex) {
    hideRowSendMenu();
    const tabs = availableSheetTabs.filter(t => t !== currentSheetTab);
    if (tabs.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'floating-tab-menu';
    menu.style.display = 'flex';
    menu.style.position = 'fixed';

    const btnRect = wrapperEl.getBoundingClientRect();
    menu.style.bottom = (window.innerHeight - btnRect.top + 4) + 'px';
    menu.style.right  = (window.innerWidth - btnRect.right) + 'px';
    menu.innerHTML = tabs.map(tab => `<button class="tab-chip" data-tab="${tab}">${tab}</button>`).join('');

    menu.querySelectorAll('.tab-chip').forEach(chip => {
        chip.onclick = async (e) => {
            e.stopPropagation();
            const log = logs[logIndex];
            if (!log) return;
            const ok = await sendLogToTargetTab(chip.dataset.tab, log, chip);
            if (ok) {
                chip.classList.add('sent');
                chip.innerText = '✓';
                setTimeout(() => window.forceHideRowSendMenu(), 600);
            }
        };
    });

    menu.onmouseenter = () => { menu._hovered = true; };
    menu.onmouseleave = () => { menu._hovered = false; hideRowSendMenu(); };
    wrapperEl._menuRef = menu;
    document.body.appendChild(menu);
    _activeRowMenu = { menu, wrapper: wrapperEl };
};

window.forceHideRowSendMenu = function() {
    if (_activeRowMenu) {
        _activeRowMenu.menu.remove();
        if (_activeRowMenu.wrapper) _activeRowMenu.wrapper._menuRef = null;
        _activeRowMenu = null;
    }
};

window.hideRowSendMenu = function() {
    if (!_activeRowMenu) return;
    const { menu, wrapper } = _activeRowMenu;
    setTimeout(() => {
        if (menu._hovered) return;
        if (wrapper.matches(':hover')) return;
        menu.remove();
        wrapper._menuRef = null;
        _activeRowMenu = null;
    }, 80);
};

// ── Import Short Floating Menu ────────────────────────────────
function buildImportShortMenu() {
    const menu = document.getElementById('importShortFloatingMenu');
    if (!menu) return;
    const tabs = availableSheetTabs.filter(t => t !== currentSheetTab);
    if (tabs.length === 0) {
        menu.innerHTML = '<div class="floating-tab-menu-inner"><span style="font-size:9px;color:var(--text-muted);padding:2px 6px;">No other tabs</span></div>';
        return;
    }
    menu.innerHTML = '<div class="floating-tab-menu-inner">' + tabs.map(tab => `<button class="tab-chip" data-tab="${tab}">${tab}</button>`).join('') + '</div>';
    menu.querySelectorAll('.tab-chip').forEach(chip => {
        chip.onclick = async (e) => {
            e.stopPropagation();
            const video = document.getElementById('videoPlayer');
            if (!video || !video.duration) { openMessageModal('Lỗi', 'Chưa có video.'); return; }

            let logDataToSend = null;
            let usedForm = false;

            if (activeInSec !== null) {
                const actionName = selectedAction || 'OTHERS';
                if (actionName === 'DELETE' && activeOutSec === null) { openMessageModal('Lỗi', 'Action DELETE bắt buộc phải có TC OUT.'); return; }
                const st = document.getElementById('inputScript').value.trim();
                const nt = document.getElementById('inputNote').value.trim();
                logDataToSend = {
                    action: actionName, inSec: activeInSec, outSec: activeOutSec, swapSec: activeSwapSec,
                    tcswap: activeSwapSec !== null ? formatTC(activeSwapSec) : '',
                    tcin: formatTC(activeInSec),
                    tcout: activeOutSec !== null ? formatTC(activeOutSec) : '',
                    script: st, note: nt, timestamp: Date.now()
                };
                usedForm = true;
            } else if (clipboardLogData !== null) {
                logDataToSend = { ...clipboardLogData, timestamp: Date.now() };
            } else {
                openMessageModal('Lỗi', 'Vui lòng thiết lập TC IN trước khi Import, hoặc Import 1 action trước để dùng lại dữ liệu (Clipboard).');
                return;
            }

            const ok = await sendLogToTargetTab(chip.dataset.tab, logDataToSend, chip);
            if (ok) {
                if (usedForm) {
                    document.getElementById('inputScript').value = '';
                    document.getElementById('inputNote').value = '';
                    activeInSec = null; activeOutSec = null; activeSwapSec = null;
                    const valTcIn  = document.getElementById('valTcIn');
                    const valTcOut = document.getElementById('valTcOut');
                    const valTcSwap = document.getElementById('valTcSwap');
                    const btnImport = document.getElementById('btnToolbarImport');
                    if (valTcIn)  valTcIn.innerText  = '00:00:00:00';
                    if (valTcOut) valTcOut.innerText = '00:00:00:00';
                    if (valTcSwap) valTcSwap.innerText = '00:00:00:00';
                    if (btnImport) btnImport.classList.remove('pulse-import');
                }
                chip.classList.add('sent');
                chip.innerText = '✓';
                setTimeout(() => { chip.classList.remove('sent'); chip.innerText = chip.dataset.tab; }, 800);
            }
        };
    });
}

// ── Show/hide "Import Short" button ──────────────────────────
function updateImportShortVisibility() {
    const wrapper = document.querySelector('.import-short-wrapper');
    if (wrapper) {
        wrapper.style.display = (currentSheetTab === 'Full-show') ? 'flex' : 'none';
    }
}
