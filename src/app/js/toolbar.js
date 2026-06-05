// ============================================================
//  AUTOSCRIPT TCP Pro — toolbar.js
//  Save Log (Import action), jumpToTC, deleteLog, saveEdit,
//  inlineUpdate, CSV Import, Sync Sheets, filters, Edit row.
//  Depends on: state.js, timecode.js, renderer.js,
//              storage.js, modals.js, playback.js, tabs.js
// ============================================================

// ── Import Action (Save Log) ──────────────────────────────────
async function logAction(actionName) {
    const video = document.getElementById('videoPlayer');
    if (!video || !video.duration) return;

    if (actionName === 'DELETE') {
        if (editingRowIndex !== null && logs[editingRowIndex].outSec === null && activeOutSec === null) {
            openMessageModal('Lỗi', 'Action DELETE bắt buộc phải có TC OUT. Vui lòng thêm TC OUT!'); return;
        } else if (editingRowIndex === null && activeOutSec === null) {
            openMessageModal('Lỗi', 'Action DELETE bắt buộc phải có TC OUT. Vui lòng thêm TC OUT!'); return;
        }
    }

    if (editingRowIndex !== null) {
        if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) document.activeElement.blur();
        logs[editingRowIndex].action = actionName;
        selectedAction = actionName;
        updateActionButtons();
        const boxSwap = document.getElementById('boxSwap');
        if (boxSwap) boxSwap.style.display = actionName === 'SWAP' ? 'block' : 'none';
        renderTable(); drawMarkers(); return;
    }

    if (activeInSec === null) return;

    // Warn if overlapping a DELETE zone
    if (actionName !== 'DELETE') {
        const newIn  = activeInSec;
        const newOut = activeOutSec !== null ? activeOutSec : activeInSec;
        const overlappingDelete = logs.find(l =>
            l.action === 'DELETE' && l.inSec !== null && l.outSec !== null &&
            newIn < l.outSec && newOut > l.inSec
        );
        if (overlappingDelete) {
            const confirmed = await openConfirmModal(
                '⚠️ Cảnh báo vùng DELETE',
                `Vùng TC IN/OUT của action "${actionName}" đang nằm trong (hoặc chồng lấn) một vùng DELETE đã đánh dấu trước đó (${formatTC(overlappingDelete.inSec)} → ${formatTC(overlappingDelete.outSec)}).\n\nĐoạn này sẽ bị xóa khi xuất bản, action mới có thể không có ý nghĩa.\n\nBạn có muốn tiếp tục thêm không?`
            );
            if (!confirmed) return;
        }
    }

    saveState();
    const st = document.getElementById('inputScript').value.trim();
    const nt = document.getElementById('inputNote').value.trim();
    logs.push({
        action: actionName,
        inSec: activeInSec, outSec: activeOutSec, swapSec: activeSwapSec,
        tcswap: activeSwapSec !== null ? formatTC(activeSwapSec) : '',
        tcin:   formatTC(activeInSec),
        tcout:  activeOutSec !== null ? formatTC(activeOutSec) : '',
        script: st, note: nt
    });
    logs.sort((a, b) => a.inSec - b.inSec);
    saveSession();
    renderTable(); drawMarkers();

    // Highlight new row
    const newIdx = logs.findIndex(l => l.inSec === activeInSec && l.action === actionName && l.script === st && l.note === nt);
    if (newIdx >= 0) {
        const row = document.getElementById('row-' + newIdx);
        if (row) {
            row.classList.add('highlight-new');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => row.classList.remove('highlight-new'), 2000);
        }
    }

    // Store to clipboard BEFORE clearing form
    clipboardLogData = {
        action: actionName,
        inSec: activeInSec, outSec: activeOutSec, swapSec: activeSwapSec,
        tcswap: activeSwapSec !== null ? formatTC(activeSwapSec) : '',
        tcin:   formatTC(activeInSec),
        tcout:  activeOutSec !== null ? formatTC(activeOutSec) : '',
        script: st, note: nt
    };

    // Clear workspace
    const valTcIn  = document.getElementById('valTcIn');
    const valTcOut = document.getElementById('valTcOut');
    const valTcSwap = document.getElementById('valTcSwap');
    const boxIn  = document.getElementById('boxIn');
    const boxOut = document.getElementById('boxOut');
    const boxSwap = document.getElementById('boxSwap');
    activeInSec = null; activeOutSec = null; activeSwapSec = null;
    if (valTcIn)  valTcIn.innerText  = formatTC(video.currentTime);
    if (valTcOut) valTcOut.innerText = formatTC(video.currentTime);
    if (valTcSwap) valTcSwap.innerText = formatTC(video.currentTime);
    document.getElementById('inputScript').value = '';
    document.getElementById('inputNote').value   = '';
    updateActiveRange();
    if (boxIn)  boxIn.classList.remove('active');
    if (boxOut) boxOut.classList.remove('active');
    if (boxSwap) boxSwap.classList.remove('active');
    renderTable(); drawMarkers();
}

function saveLog() { logAction(selectedAction); }

// ── Jump to TC from table ─────────────────────────────────────
window.jumpToTC = function(index, field, useMaster = false) {
    const logArray = useMaster ? (tabLogsCache['Full-show'] || logs) : logs;
    const log = logArray[index];
    if (!log) return;

    const video    = document.getElementById('videoPlayer');
    const valTcIn  = document.getElementById('valTcIn');
    const valTcOut = document.getElementById('valTcOut');
    const valTcSwap = document.getElementById('valTcSwap');
    const boxIn   = document.getElementById('boxIn');
    const boxOut  = document.getElementById('boxOut');
    const boxSwap = document.getElementById('boxSwap');

    tcAutoSelected = true;
    tcJumpWait = true;

    if (log.inSec !== undefined && log.inSec !== null) {
        activeInSec = log.inSec;
        if (valTcIn) valTcIn.innerText = formatTC(activeInSec);
        if (boxIn) boxIn.classList.add('active');
    }
    if (log.outSec !== undefined && log.outSec !== null) {
        activeOutSec = log.outSec;
        if (valTcOut) valTcOut.innerText = formatTC(activeOutSec);
        if (boxOut) boxOut.classList.add('active');
    }
    if (log.swapSec !== undefined && log.swapSec !== null && valTcSwap) {
        activeSwapSec = log.swapSec;
        valTcSwap.innerText = formatTC(activeSwapSec);
        if (boxSwap) boxSwap.classList.add('active');
    }

    document.getElementById('inputScript').value = log.script || '';
    document.getElementById('inputNote').value   = log.note   || '';
    if (log.action) { selectedAction = log.action; updateActionButtons(); }
    updateActiveRange();

    const sec = parseTC(log[field]);
    if (sec !== null && !isNaN(sec)) {
        if (video) video.currentTime = sec;
        let targetZoom = 50;
        let pts = [];
        if (log.inSec !== null) pts.push(log.inSec);
        if (log.outSec !== null) pts.push(log.outSec);
        if (log.action === 'SWAP' && log.swapSec !== null) pts.push(log.swapSec);
        let centerSec = sec;
        if (pts.length >= 2) {
            const minSec = Math.min(...pts), maxSec = Math.max(...pts);
            const validDur = maxSec - minSec;
            if (validDur > 0) {
                targetZoom = Math.max(1, Math.min(50, video.duration / (validDur * 3)));
                centerSec  = minSec + validDur / 2;
            }
        }
        applyZoom(targetZoom, false, centerSec);
    }
};

// ── Delete Log ────────────────────────────────────────────────
window.deleteLog = function(index) {
    saveState();
    logs.splice(index, 1);
    if (editingRowIndex === index) editingRowIndex = null;
    else if (editingRowIndex > index) editingRowIndex--;
    renderTable(); drawMarkers(); saveSession();
};

// ── Save/Exit Edit Mode ───────────────────────────────────────
function saveEdit() {
    const video = document.getElementById('videoPlayer');
    const valTcIn  = document.getElementById('valTcIn');
    const valTcOut = document.getElementById('valTcOut');
    const valTcSwap = document.getElementById('valTcSwap');
    const boxIn   = document.getElementById('boxIn');
    const boxOut  = document.getElementById('boxOut');
    const boxSwap = document.getElementById('boxSwap');

    if (editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < logs.length) {
        const log    = logs[editingRowIndex];
        const scriptEl = document.getElementById('inputScript');
        const noteEl   = document.getElementById('inputNote');
        if (scriptEl) log.script = scriptEl.value.trim();
        if (noteEl)   log.note   = noteEl.value.trim();
        log.tcin  = formatTC(log.inSec);
        log.tcout = log.outSec ? formatTC(log.outSec) : '00:00:00:00';
        log.tcswap = log.swapSec ? formatTC(log.swapSec) : '';
    }
    editingRowIndex = null;
    activeInSec = null; activeOutSec = null; activeSwapSec = null;
    if (valTcIn)  valTcIn.innerText  = '00:00:00:00';
    if (valTcOut) valTcOut.innerText = '00:00:00:00';
    if (valTcSwap) valTcSwap.innerText = '00:00:00:00';
    document.getElementById('inputScript').value = '';
    document.getElementById('inputNote').value   = '';
    updateActiveRange();
    if (boxIn)  boxIn.classList.remove('active');
    if (boxOut) boxOut.classList.remove('active');
    if (boxSwap) boxSwap.classList.remove('active');
    saveSession();
    renderTable(); drawMarkers();
}

// ── Inline Table Cell Edit ────────────────────────────────────
window.inlineUpdate = function(index, field, element) {
    saveState();
    logs[index][field] = element.value || element.innerText.trim();
    if (field === 'tcswap') { logs[index].swapSec = parseTC(logs[index].tcswap); drawMarkers(); }
    if (field === 'tcin')   { logs[index].inSec   = parseTC(logs[index].tcin);   drawMarkers(); }
    if (field === 'tcout')  { logs[index].outSec  = parseTC(logs[index].tcout);  drawMarkers(); }
    saveSession();
};

// ── CSV / Excel Import ────────────────────────────────────────
function initCSVImport() {
    const csvImportEl = document.getElementById('csvImport');
    if (!csvImportEl) return;
    csvImportEl.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const data     = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet    = workbook.Sheets[workbook.SheetNames[0]];
                const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                const newLogs  = [];
                for (let i = 4; i < rows.length; i++) {
                    const cols = rows[i];
                    if (!cols || cols.length === 0) continue;
                    let action = (cols[1] || '').toString().trim();
                    if (action === 'DELTELE') action = 'DELETE';
                    let tcswap = (cols[2] || '').toString().trim();
                    let tcin   = (cols[3] || '').toString().trim();
                    let tcout  = (cols[4] || '').toString().trim();
                    let script = (cols[5] || '').toString().trim();
                    let note   = (cols[6] || '').toString().trim();
                    if (action || tcin || script) {
                        newLogs.push({ action, tcswap, tcin, tcout, script, note, inSec: parseTC(tcin), outSec: parseTC(tcout) || null, swapSec: tcswap ? parseTC(tcswap) : null });
                    }
                }
                if (newLogs.length > 0) {
                    openConfirmModal('Import Data', `Tìm thấy ${newLogs.length} dòng. Ghi đè danh sách hiện tại?`).then(ok => {
                        if (ok) { logs = newLogs; renderTable(); drawMarkers(); saveProjectLogsToKV(); }
                    });
                } else {
                    openMessageModal('Lỗi Import', 'File không hợp lệ hoặc rỗng!');
                }
            } catch (err) {
                console.error(err);
                openMessageModal('Lỗi Import', 'Không thể đọc file. Vui lòng chọn file Excel (.xlsx) hoặc CSV hợp lệ.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });
}
