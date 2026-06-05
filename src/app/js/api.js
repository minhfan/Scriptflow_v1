// ============================================================
//  AUTOSCRIPT TCP Pro — api.js
//  Cloudflare KV persistence layer (project logs).
//  Depends on: state.js, constants.js
// ============================================================

// ── Legacy localStorage fallback ─────────────────────────────
function getLegacyLocalLogs() {
    try {
        const savedLogs = JSON.parse(localStorage.getItem(LEGACY_LOG_STORAGE_KEY));
        return Array.isArray(savedLogs) ? savedLogs : [];
    } catch (error) {
        return [];
    }
}

/**
 * Persist current tab logs to Cloudflare KV via PUT API.
 * @param {string} [tabOverride] - Override which tab to save (default: currentSheetTab)
 * @param {Array}  [logsOverride] - Override which log array to save (default: logs)
 */
async function saveProjectLogsToKV(tabOverride, logsOverride) {
    if (!currentSpreadsheetId) return;
    const tabToSave  = tabOverride  || currentSheetTab;
    const logsToSave = logsOverride !== undefined ? logsOverride : logs;

    try {
        const res = await fetch('/tcpscript/api/project-logs', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                projectId: currentSpreadsheetId,
                sheetTab: tabToSave,
                logs: logsToSave
            })
        });
        if (!res.ok) {
            console.error('[API] saveProjectLogsToKV failed:', res.status);
        }
    } catch (err) {
        console.error('[API] saveProjectLogsToKV network error:', err);
    }
    localStorage.removeItem(LEGACY_LOG_STORAGE_KEY);
}

/**
 * Load project logs from Cloudflare KV.
 * Uses a request token to guard against race conditions when
 * switching tabs rapidly.
 *
 * @param {string} [tabOverride] - Which tab to load (default: currentSheetTab)
 * @returns {boolean} true if load was committed, false if stale/cancelled
 */
async function loadProjectLogsFromKV(tabOverride) {
    const requestTab   = String(tabOverride || currentSheetTab).trim();
    const requestToken = ++projectLogsLoadToken;

    if (!currentSpreadsheetId) {
        if (requestToken !== projectLogsLoadToken) return false;
        logs = getLegacyLocalLogs();
        tabLogsCache[requestTab] = JSON.parse(JSON.stringify(logs));
        isProjectLogsLoaded = true;
        return true;
    }

    let loadedLogs = [];

    try {
        const res = await fetch(
            `/tcpscript/api/project-logs?id=${encodeURIComponent(currentSpreadsheetId)}&tab=${encodeURIComponent(requestTab)}&t=${Date.now()}`,
            {
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data   = await res.json();
        const kvLogs = Array.isArray(data.logs) ? data.logs : [];

        if (kvLogs.length > 0) {
            loadedLogs = kvLogs;
            localStorage.removeItem(LEGACY_LOG_STORAGE_KEY);
        } else if (requestTab === 'Full-show') {
            const legacyLogs = getLegacyLocalLogs();
            if (legacyLogs.length > 0) {
                loadedLogs = legacyLogs;
                await saveProjectLogsToKV(requestTab, loadedLogs);
            } else {
                loadedLogs = [];
            }
        } else {
            loadedLogs = [];
        }
    } catch (error) {
        console.warn('[API] loadProjectLogsFromKV error:', error);
        loadedLogs = (requestTab === 'Full-show') ? getLegacyLocalLogs() : [];
    }

    // Stale check: another tab switch happened while we were fetching
    if (requestToken !== projectLogsLoadToken) return false;

    logs = loadedLogs;
    tabLogsCache[requestTab] = JSON.parse(JSON.stringify(loadedLogs));
    isProjectLogsLoaded = true;
    return true;
}

// ── Project Meta ─────────────────────────────────────────────
function getSpreadsheetIdFromPath() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const appIndex = segments.indexOf('app');
    if (appIndex === -1 || !segments[appIndex + 1]) return '';
    try {
        return decodeURIComponent(segments[appIndex + 1]);
    } catch (error) {
        return segments[appIndex + 1];
    }
}

async function resolveCurrentSpreadsheetMeta() {
    if (!currentSpreadsheetId) return;

    try {
        const res = await fetch(`/tcpscript/api/projects/meta?id=${encodeURIComponent(currentSpreadsheetId)}`, {
            credentials: 'same-origin'
        });
        if (!res.ok) return;

        const project = await res.json();
        currentSpreadsheetUrl  = project.url  || currentSpreadsheetUrl  || `https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/edit`;
        currentSpreadsheetName = project.name || currentSpreadsheetName || 'Google Sheet';
        currentProjectVideoMeta = sanitizeProjectVideoMeta(project.videoMeta) || getCachedProjectVideoMeta(currentSpreadsheetId);
        localStorage.setItem('autoscript_current_spreadsheet_id',   currentSpreadsheetId);
        localStorage.setItem('autoscript_current_spreadsheet_url',  currentSpreadsheetUrl);
        localStorage.setItem('autoscript_current_spreadsheet_name', currentSpreadsheetName);
        renderProjectVideoMeta();
    } catch (error) {
        console.warn('[API] Failed to resolve project metadata:', error);
        currentProjectVideoMeta = getCachedProjectVideoMeta(currentSpreadsheetId);
        renderProjectVideoMeta();
    }
}

// ── Google Sheets Tab List ────────────────────────────────────
async function loadSheetTabsFromGoogle() {
    if (!currentSpreadsheetId) return;
    try {
        const url = `/tcpscript/api/google-sheets?action=getTabs&id=${currentSpreadsheetId}&t=${Date.now()}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${sessionToken}` } });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.tabs) {
                // Filter out internal/template tab
                availableSheetTabs = data.tabs.filter(tab => tab !== 'Reels 1.1');
                renderSheetTabs();
            } else {
                console.error('[API] getTabs failed:', data);
            }
        }
    } catch (e) {
        console.error('[API] Failed to load tabs:', e);
    }
}

// ── Google Sheets Sync ────────────────────────────────────────
async function syncToGoogleSheets() {
    if (!logs.length) {
        openMessageModal('Đồng bộ Google Sheets', 'Danh sách log rỗng. Không có gì để đồng bộ.');
        return;
    }

    const btn = document.getElementById('btnSyncSheets');
    const originalText = btn ? btn.innerText : 'Sync Sheet';
    if (btn) { btn.innerText = 'Syncing...'; btn.disabled = true; }

    try {
        const sheetId = currentSpreadsheetId || TEMPLATE_SPREADSHEET_ID;
        
        const isFeedback = !!isFeedbackMode;
        const targetTab = isFeedback ? 'Feedback' : (currentSheetTab || 'Full-show');
        
        const logsToSync = logs.filter(log => !!log.isFeedback === isFeedback);
        
        // Include reviewNote and status if it's feedback mode
        const values = logsToSync.map(log => {
            if (isFeedback) {
                return ["", log.action, log.tcin, log.tcout, log.tcswap, log.script, log.note, log.reviewNote || '', log.status || 'pending'];
            }
            return ["", log.action, log.tcin, log.tcout, log.tcswap, log.script, log.note];
        });

        const writeRes = await fetch('/tcpscript/api/google-sheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'syncLogs',
                sheetId,
                tab: targetTab,
                values
            })
        });

        if (!writeRes.ok) {
            const errTxt = await writeRes.text();
            throw new Error('Lỗi đồng bộ qua proxy: ' + errTxt);
        }

        const writeData = await writeRes.json();
        if (writeData.status === 'error') throw new Error(writeData.message || 'Lỗi từ Google Apps Script');

        if (window.showToast) {
            window.showToast(`Đồng bộ thành công! (Lưu ý: Nếu lỗi, hãy chắc chắn file Sheets có tab '${targetTab}')`, 'success');
        } else {
            openMessageModal('Đồng bộ Google Sheets', `Đồng bộ thành công vào tab '${targetTab}'.`);
        }
    } catch (error) {
        console.error('[API SYNC ERROR]', error);
        if (window.showToast) {
            window.showToast(error.message || 'Không thể đồng bộ', 'error');
        } else {
            openMessageModal('Lỗi đồng bộ', error.message || 'Không thể gửi yêu cầu đồng bộ.');
        }
    } finally {
        if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

// ── Video Meta Persistence ────────────────────────────────────
function sanitizeProjectVideoMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const fileName = String(meta.fileName || '').trim();
    if (!fileName) return null;
    return {
        fileName,
        fileSize:     Number.isFinite(Number(meta.fileSize))     ? Number(meta.fileSize)     : 0,
        fileType:     String(meta.fileType || '').trim(),
        lastModified: Number.isFinite(Number(meta.lastModified)) ? Number(meta.lastModified) : 0,
        durationSec:  Number.isFinite(Number(meta.durationSec))  ? Number(meta.durationSec)  : 0,
        updatedAt:    meta.updatedAt ? String(meta.updatedAt) : ''
    };
}

function getProjectVideoMetaCache() {
    try { return JSON.parse(localStorage.getItem(PROJECT_VIDEO_META_CACHE_KEY) || '{}'); }
    catch (error) { return {}; }
}

function getCachedProjectVideoMeta(projectId) {
    if (!projectId) return null;
    return sanitizeProjectVideoMeta(getProjectVideoMetaCache()[projectId]);
}

function setCachedProjectVideoMeta(projectId, meta) {
    if (!projectId) return;
    const cache = getProjectVideoMetaCache();
    cache[projectId] = sanitizeProjectVideoMeta(meta);
    localStorage.setItem(PROJECT_VIDEO_META_CACHE_KEY, JSON.stringify(cache));
}

async function persistProjectVideoMeta(meta) {
    const safeMeta = sanitizeProjectVideoMeta(meta);
    if (!currentSpreadsheetId || !safeMeta) return;

    currentProjectVideoMeta = safeMeta;
    setCachedProjectVideoMeta(currentSpreadsheetId, safeMeta);
    renderProjectVideoMeta();

    try {
        await fetch('/tcpscript/api/projects/video-meta', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentSpreadsheetId, videoMeta: safeMeta })
        });
    } catch (error) {
        console.warn('[API] Failed to sync video metadata:', error);
    }
}
