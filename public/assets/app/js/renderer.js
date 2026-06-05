// ============================================================
//  AUTOSCRIPT TCP Pro — renderer.js
//  renderTable, drawMarkers, renderTimelineTicks,
//  renderSheetTabs, renderProjectVideoMeta, updateActiveSheetUI
//  Depends on: state.js, constants.js, timecode.js, api.js
// ============================================================

// ── Utility ──────────────────────────────────────────────────
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

// ── Row Action (called from inline HTML) ─────────────────────
window.updateRowAction = function(index, action) {
    if (index >= 0 && index < logs.length) {
        logs[index].action = action;
        renderTable();
        drawMarkers();
        saveSession();
    }
};

window.updateRowStatus = function(index, status) {
    if (index >= 0 && index < logs.length) {
        logs[index].status = status;
        renderTable();
        saveSession();
    }
};

// ── Render Log Table ─────────────────────────────────────────
function renderTable() {
    if (isFeedbackMode) {
        if (typeof renderFeedbackFeed === 'function') {
            return renderFeedbackFeed();
        }
    }

    const tw = document.querySelector('.table-wrap');
    const sb = document.getElementById('storyboardContainer');
    const fb = document.getElementById('feedbackContainer');
    const oldScrollTop = tw ? tw.scrollTop : 0;
    const tbody = document.getElementById('logBody');
    if (!tbody || !sb || !tw) return;
    
    if (fb) fb.style.display = 'none';
    tbody.innerHTML = '';
    sb.innerHTML = '';
    let count = 0;

    if (isStoryboardView) {
        tw.style.display = 'none';
        sb.style.display = 'grid';
    } else {
        tw.style.display = 'block';
        sb.style.display = 'none';
    }

    // Add indexing to keep original indices, then filter by mode and current active action list
    const activeLogs = logs.map((log, index) => ({ log, index })).filter(item => {
        if (!!item.log.isFeedback !== !!isFeedbackMode) return false;
        if (filterQuery !== 'ALL' && item.log.action !== filterQuery) return false;
        if (searchQuery) {
            const text = (item.log.script + ' ' + item.log.note + ' ' + item.log.tcin + ' ' + item.log.tcout + ' ' + (item.log.tcswap || '')).toLowerCase();
            if (!text.includes(searchQuery)) return false;
        }
        count++;
        return true;
    });

    activeLogs.forEach(item => {
        const log = item.log;
        const index = item.index;
        const colorSet = actionColors[log.action] || { bg: '#1e293b', color: '#e2e8f0' };
        const bg = colorSet.bg, txt = colorSet.color;
        const showPreview = (log.action === 'DELETE' || log.action === 'SWAP');
        const playButton = showPreview
            ? `<button class="btn-play-delete" onclick="playActionPreview(${index})" title="Preview action">&#9658;</button>`
            : '';
        const isEditing = (index === editingRowIndex);
        const editable  = isEditing ? 'contenteditable="true"' : '';
        const editClass = isEditing ? 'row-editing' : '';

        let actionCell;
        let annotIcon = '';
        if (log.drawing) {
            annotIcon = `<span style="margin-left: 6px; font-size: 11px; cursor: pointer; filter: grayscale(100%); transition: all 0.2s;" title="Has Annotation" onclick="window.openAnnotationModal(event, ${index}); event.stopPropagation();" onmouseover="this.style.filter='grayscale(0)'" onmouseout="this.style.filter='grayscale(100%)'">🖌️</span>`;
        }

        if (isEditing) {
            const opts = actionList.map(a =>
                `<option value="${a}" ${a === log.action ? 'selected' : ''}>${escapeHtml(a)}</option>`
            ).join('');
            actionCell = `<div style="display: flex; align-items: center;"><select onchange="window.updateRowAction(${index}, this.value)" style="width:auto; padding:3px 8px; font-size:7.92px; font-weight:700; background:${bg}; color:${txt}; border:1px solid rgba(255,255,255,0.2); border-radius:var(--r-sm); outline:none; text-align:center; cursor:pointer; font-family:'Outfit',sans-serif; min-width:68px; letter-spacing:0.05em;">${opts}</select>${annotIcon}</div>`;
        } else {
            actionCell = `<div style="display: flex; align-items: center;"><span class="action-tag" style="background:${bg};color:${txt}">${escapeHtml(log.action)}</span>${annotIcon}</div>`;
        }

        const swapVal = log.tcswap || '';
        const outVal  = log.tcout === '00:00:00:00' ? '' : log.tcout;
        
        let thumbCell = '';
        if (log.thumb) {
            thumbCell = `<img src="${log.thumb}" alt="thumb" style="width: 50px; height: auto; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-bright); cursor: pointer;" onclick="window.openAnnotationModal(event, ${index})">`;
        } else {
            thumbCell = `<div style="width: 50px; height: 28px; background: rgba(255,255,255,0.05); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 10px;">-</div>`;
        }

        const currentStatus = log.status || 'pending';
        let statusColor = 'var(--text-muted)';
        if (currentStatus === 'approved') statusColor = '#22c55e'; // green
        if (currentStatus === 'needs_fix') statusColor = '#ef4444'; // red

        const statusSelect = `
            <select onchange="window.updateRowStatus(${index}, this.value)" style="width:100%; padding:3px 4px; font-size:9px; font-weight:700; background:transparent; color:${statusColor}; border:1px solid var(--border); border-radius:4px; outline:none; cursor:pointer;">
                <option value="pending" style="color:#000;" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="approved" style="color:#000;" ${currentStatus === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="needs_fix" style="color:#000;" ${currentStatus === 'needs_fix' ? 'selected' : ''}>Needs Fix</option>
            </select>
        `;

        if (isStoryboardView) {
            let sbThumb = '';
            if (log.thumb) {
                sbThumb = `<img src="${log.thumb}" alt="thumb" onclick="window.openAnnotationModal(${index})">`;
            } else {
                sbThumb = `<div class="storyboard-card-thumb-placeholder">
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M20.4 14.5L16 10 4 20"/></svg>
                               <span>No Image</span>
                           </div>`;
            }
            
            sb.innerHTML += `
                <div class="storyboard-card" id="card-${index}" oncontextmenu="showRowMenu(event, ${index})" style="${currentStatus === 'needs_fix' ? 'border: 1px solid #ef4444;' : currentStatus === 'approved' ? 'border: 1px solid #22c55e;' : ''}">
                    <div class="storyboard-card-thumb">
                        ${sbThumb}
                        <div class="storyboard-card-action">${actionCell}</div>
                    </div>
                    <div class="storyboard-card-body">
                        <div style="margin-bottom: 4px;">${statusSelect}</div>
                        <div class="storyboard-card-tc">
                            <span onclick="window.jumpToTC(${index},'tcin')" style="cursor: pointer;">IN: ${escapeHtml(log.tcin)}</span>
                            ${outVal ? `<span onclick="window.jumpToTC(${index},'tcout')" style="cursor: pointer;">OUT: ${escapeHtml(outVal)}</span>` : ''}
                        </div>
                        <div class="storyboard-card-text">${escapeHtml(log.script) || '<em style="color:var(--text-muted);font-size:10px;">(Trống)</em>'}</div>
                        ${log.note ? `<div class="storyboard-card-note">${escapeHtml(log.note)}</div>` : ''}
                        ${log.reviewNote ? `<div class="storyboard-card-note" style="background:rgba(239, 68, 68, 0.1); border-left-color: #ef4444;"><strong>Review:</strong> ${escapeHtml(log.reviewNote)}</div>` : ''}
                        <div class="storyboard-card-tools">
                            ${playButton || '<span></span>'}
                            <button class="btn-delete" onclick="deleteLog(${index})" title="Delete">&#10006;</button>
                        </div>
                    </div>
                </div>`;
        } else {
            tbody.innerHTML += `
                <tr id="row-${index}" class="log-row ${editClass}" oncontextmenu="showRowMenu(event, ${index})" style="${currentStatus === 'needs_fix' ? 'background: rgba(239, 68, 68, 0.05);' : currentStatus === 'approved' ? 'background: rgba(34, 197, 94, 0.05);' : ''}">
                    <td class="td-stt">${index + 1}</td>
                    <td class="td-play">${playButton}</td>
                    <td class="td-thumb feedback-only" style="text-align: center; padding: 4px;">${thumbCell}</td>
                    <td class="td-status feedback-only" style="padding: 4px;">${statusSelect}</td>
                    <td class="td-action">${actionCell}</td>
                    <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcin')" onblur="inlineUpdate(${index},'tcin',this)">${escapeHtml(log.tcin)}</td>
                    <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcout')" onblur="inlineUpdate(${index},'tcout',this)">${outVal ? escapeHtml(outVal) : ''}</td>
                    <td class="td-tc" ${editable} onclick="window.jumpToTC(${index},'tcswap')" onblur="inlineUpdate(${index},'tcswap',this)">${swapVal ? escapeHtml(swapVal) : ''}</td>
                    <td class="td-text" ${editable} onclick="if(this.getAttribute('contenteditable')!=='true') window.jumpToTC(${index},'tcin')" onblur="inlineUpdate(${index},'script',this)">${escapeHtml(log.script)}</td>
                    <td class="td-text" ${editable} onclick="if(this.getAttribute('contenteditable')!=='true') window.jumpToTC(${index},'tcin')" onblur="inlineUpdate(${index},'note',this)">${escapeHtml(log.note)}</td>
                    <td class="td-text feedback-only" ${editable} onclick="if(this.getAttribute('contenteditable')!=='true') window.jumpToTC(${index},'tcin')" onblur="inlineUpdate(${index},'reviewNote',this)">${escapeHtml(log.reviewNote || '')}</td>
                    <td class="td-delete"><span class="row-tools"><span class="send-tab-wrapper" onmouseenter="buildRowSendMenu(this, ${index})" onmouseleave="hideRowSendMenu(this)"><button class="btn-send" title="Send to Tab">SEND</button></span><button class="btn-delete" onclick="deleteLog(${index})" title="Delete">&#10006;</button></span></td>
                </tr>`;
        }
    });

    const logCount = document.getElementById('logCount');
    if (logCount) logCount.innerText = count;
    if (tw) tw.scrollTop = oldScrollTop;
}

// ── Draw Timeline Markers (SmartTags) ────────────────────────
function drawMarkers() {
    const timelineWrapper = document.getElementById('customTimeline');
    const video = document.getElementById('videoPlayer');
    if (!timelineWrapper || !video) return;

    Array.from(timelineWrapper.querySelectorAll('.marker-range')).forEach(el => el.remove());

    // Always use Full-show logs as source of truth for the universal marker layer
    const masterLogs = tabLogsCache['Full-show'] || logs;
    if (!video.duration || !masterLogs.length) return;

    // Sort by duration descending so longer items render behind shorter ones
    const sortedLogs = masterLogs
        .map((log, origIndex) => ({ log, origIndex }))
        .filter(item => !!item.log.isFeedback === !!isFeedbackMode)
        .sort((a, b) => {
            const durA = (a.log.outSec && a.log.outSec > a.log.inSec) ? (a.log.outSec - a.log.inSec) : 0;
            const durB = (b.log.outSec && b.log.outSec > b.log.inSec) ? (b.log.outSec - b.log.inSec) : 0;
            return durB - durA;
        });

    const placed = [];

    sortedLogs.forEach(item => {
        const log = item.log;
        const origIndex = item.origIndex;
        const colorSet  = actionColors[log.action] || { bg: '#1e293b', color: '#e2e8f0' };
        const colorHex  = colorSet.bg;
        const hasDuration = log.outSec && log.outSec > log.inSec;
        const startSec  = log.inSec;
        const endSec    = hasDuration ? log.outSec : log.inSec + 0.1;
        const startPct  = (startSec / video.duration) * 100;

        let level = 0;
        while (placed.some(p => p.level === level && Math.max(startSec, p.start) < Math.min(endSec, p.end))) {
            level++;
        }
        placed.push({ start: startSec, end: endSec, level });

        let hideText = true; // Force hide text per new UI requirements
        if (hasDuration) {
            const timelineWidthPx = timelineWrapper.clientWidth || 1;
            const markerWidthPx   = ((endSec - startSec) / video.duration) * timelineWidthPx;
        }

        const marker = document.createElement('div');
        marker.className = 'marker-range';
        marker.style.left = startPct + '%';
        if (hasDuration) {
            marker.style.width = ((endSec - startSec) / video.duration) * 100 + '%';
        } else {
            marker.style.width = '0%';
        }
        marker.style.backgroundColor = colorHex + 'CC'; // Increase opacity

        const topOffsetDur   = 24 + (level * 22);
        const topOffsetNoDur = 36 + (level * 22);
        const lineOffsetNoDur = 16 + (level * 22);

        let pillHTML = '';
        if (hasDuration) {
            pillHTML = `
                <div class="action-pill" style="position:absolute; top:-${topOffsetDur}px; left:0; width:100%; height:18px; display:flex; align-items:center; justify-content:center; background:${colorHex}; color:${colorSet.color}; font-size:10px; font-weight:bold; border-radius:6px; pointer-events:auto; cursor:pointer; border:1px solid rgba(255,255,255,0.3); z-index:5; box-shadow:0 2px 4px rgba(0,0,0,0.3); overflow:hidden; text-overflow:ellipsis;">
                    <span class="action-pill-text" style="display: ${hideText ? 'none' : 'inline'}">${escapeHtml(log.action)}</span>
                </div>`;
        } else {
            pillHTML = `
                <div class="action-pill" style="position:absolute; top:-${topOffsetNoDur}px; left:0; transform:translateX(-50%); background:${colorHex}; width:6px; height:18px; border-radius:3px; pointer-events:auto; cursor:pointer; border:1px solid rgba(255,255,255,0.5); z-index:5; box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
                <div style="position:absolute; top:-${lineOffsetNoDur}px; left:0; transform:translateX(-50%); width:2px; height:${lineOffsetNoDur}px; background:rgba(255,255,255,0.3); z-index:4;"></div>`;
        }

        let tooltipContent = '';
        if (log.script) tooltipContent += `<div style="margin-bottom:4px;"><strong style="color:#aaa;">Script:</strong><br>${escapeHtml(log.script)}</div>`;
        if (log.note)   tooltipContent += `<div><strong style="color:#aaa;">Note:</strong><br>${escapeHtml(log.note)}</div>`;

        marker.innerHTML = pillHTML;

        marker.addEventListener('mousedown', ev => {
            if (ev.target.closest('.action-pill')) {
                ev.stopPropagation();
                window.jumpToTC(origIndex, 'tcin', true);
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
            gt.style.background = `${colorHex}F2`;
            gt.innerHTML = `<span style="font-size:12px;text-align:left;white-space:pre-wrap;color:white;line-height:1.4;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${tooltipContent}</span>`;
            gt.style.display = 'flex';
            const pill = marker.querySelector('.action-pill');
            const rect = (pill || marker).getBoundingClientRect();
            gt.style.left      = (rect.left + rect.width / 2) + 'px';
            gt.style.top       = (rect.top - 10) + 'px';
            gt.style.transform = 'translate(-50%, -100%)';
        });

        marker.addEventListener('mouseleave', () => {
            const gt = document.getElementById('globalTooltip');
            if (gt) gt.style.display = 'none';
        });

        timelineWrapper.appendChild(marker);

        // SWAP secondary marker
        if (log.action === 'SWAP' && log.swapSec != null) {
            const swapLeftPct = (log.swapSec / video.duration) * 100;
            const swapMarker  = document.createElement('div');
            swapMarker.className = 'marker-range marker-swap';
            swapMarker.style.cssText = `position:absolute; top:0; height:100%; left:${swapLeftPct}%; pointer-events:auto; cursor:pointer;`;
            swapMarker.innerHTML = `
                <div style="position:absolute; top: -14px; left: 0; transform: translateX(-50%); width: 14px; height: calc(100% + 14px); z-index: 6;">
                    <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 100%; background: #ea580c;"></div>
                    <div style="position:absolute; top: -5px; left: 50%; transform: translateX(-50%); border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #ea580c;"></div>
                </div>`;
            swapMarker.addEventListener('mousedown', e => {
                e.stopPropagation();
                video.currentTime = log.swapSec;
            });
            timelineWrapper.appendChild(swapMarker);
        }
    });
}

// ── Render Timeline Tick Labels ───────────────────────────────
function renderTimelineTicks() {
    const ticksContainer = document.getElementById('timelineTicks');
    const video = document.getElementById('videoPlayer');
    if (!ticksContainer || !video || !video.duration) return;
    ticksContainer.innerHTML = '';
    const duration = video.duration;

    const visibleDuration = duration / timelineZoom;
    const targetStep = visibleDuration / 10;
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
    let step = steps[steps.length - 1];
    for (let s of steps) {
        if (s >= targetStep) { step = s; break; }
    }

    for (let t = 0; t <= duration; t += step) {
        const pct  = (t / duration) * 100;
        const tick = document.createElement('div');
        tick.style.cssText = `position:absolute; left:${pct}%; top:0; height:100%; border-left:1px solid rgba(255,255,255,0.1);`;

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
        label.style.cssText = `position:absolute; top:28px; left:-10px; font-size:9px; color:var(--text-muted); pointer-events:none;`;

        tick.appendChild(label);
        ticksContainer.appendChild(tick);
    }
}

// ── Render Sheet Tabs ─────────────────────────────────────────
function renderSheetTabs() {
    const container = document.getElementById('sheetTabsContainer');
    if (!container) return;
    container.innerHTML = '';
    availableSheetTabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'sheet-tab' + (tab === currentSheetTab ? ' active' : '');
        btn.dataset.tab = tab;
        btn.innerText   = tab;
        btn.onclick     = () => switchSheetTab(tab);
        container.appendChild(btn);
    });
}

// ── Render Project Video Meta ─────────────────────────────────
function formatVideoMetaBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes, unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex++; }
    return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatVideoMetaDuration(durationSec) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return '';
    const totalSec = Math.round(durationSec);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    if (hh > 0) return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function formatVideoMetaDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderProjectVideoMeta() {
    const summaryEl = document.getElementById('videoMetaSummary');
    const video     = document.getElementById('videoPlayer');
    if (!summaryEl) return;

    const hasLoadedVideo = !!(video && (video.currentSrc || video.src));
    if (hasLoadedVideo) { summaryEl.style.display = 'none'; summaryEl.innerHTML = ''; return; }

    const meta = sanitizeProjectVideoMeta(currentProjectVideoMeta);
    if (!meta) { summaryEl.style.display = 'none'; summaryEl.innerHTML = ''; return; }

    const detailParts = [];
    const sizeText     = formatVideoMetaBytes(meta.fileSize);
    const durationText = formatVideoMetaDuration(meta.durationSec);
    const updatedText  = formatVideoMetaDate(meta.updatedAt);
    if (sizeText)     detailParts.push(sizeText);
    if (durationText) detailParts.push(durationText);
    if (updatedText)  detailParts.push(updatedText);

    summaryEl.style.display = 'block';
    summaryEl.innerHTML = `<strong>LAST ACTIVE:</strong> <span style="color:var(--text-main); font-weight: 600;">${escapeHtml(meta.fileName)}</span>${detailParts.length ? `<br><span style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">${escapeHtml(detailParts.join(' · '))}</span>` : ''}`;
}

// ── Update Active Sheet Link in header ───────────────────────
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

// ── Update Timeline Active Range Overlay ─────────────────────
function updateTimeline() {
    drawMarkers();
    renderTimelineTicks();
}

function updateActiveRange() {
    const video        = document.getElementById('videoPlayer');
    const activeRange  = document.getElementById('activeRange');
    const draftMarker  = document.getElementById('draftMarker');
    const swapIndicator = document.getElementById('activeSwapIndicator');
    const btnToolbarImport = document.getElementById('btnToolbarImport');
    if (!video || !video.duration || !activeRange) return;

    if (btnToolbarImport) {
        if (activeInSec !== null) btnToolbarImport.classList.add('pulse-import');
        else btnToolbarImport.classList.remove('pulse-import');
    }

    if (activeInSec !== null && activeOutSec !== null) {
        activeRange.style.display = 'block';
        activeRange.style.left    = (activeInSec / video.duration) * 100 + '%';
        activeRange.style.width   = ((activeOutSec - activeInSec) / video.duration) * 100 + '%';
        const colorSet = actionColors[selectedAction] || { bg: 'rgba(239, 68, 68, 0.4)' };
        activeRange.style.background = colorSet.bg + '66';
        if (draftMarker) draftMarker.style.display = 'none';
    } else if (activeInSec !== null && activeOutSec === null) {
        activeRange.style.display = 'none';
        if (draftMarker) {
            draftMarker.style.display = 'block';
            const draftOut = Math.max(activeInSec, video.currentTime);
            draftMarker.style.left    = (activeInSec / video.duration) * 100 + '%';
            draftMarker.style.width   = ((draftOut - activeInSec) / video.duration) * 100 + '%';
            const colorSet = actionColors[selectedAction] || { bg: 'rgba(255,255,255,0.7)' };
            draftMarker.style.background = colorSet.bg;
            draftMarker.style.opacity    = '0.5';
        }
    } else {
        activeRange.style.display = 'none';
        if (draftMarker) draftMarker.style.display = 'none';
    }

    if (selectedAction === 'SWAP' && activeSwapSec !== null) {
        if (swapIndicator) {
            swapIndicator.style.display = 'block';
            swapIndicator.style.left    = (activeSwapSec / video.duration) * 100 + '%';
        }
    } else {
        if (swapIndicator) swapIndicator.style.display = 'none';
    }

    const inIndicator  = document.getElementById('activeInIndicator');
    const outIndicator = document.getElementById('activeOutIndicator');
    const swapInd2     = document.getElementById('activeSwapIndicator');
    if (activeInSec !== null) { if (inIndicator) { inIndicator.style.display = 'block'; inIndicator.style.left = (activeInSec / video.duration) * 100 + '%'; } }
    else { if (inIndicator) inIndicator.style.display = 'none'; }
    if (activeOutSec !== null) { if (outIndicator) { outIndicator.style.display = 'block'; outIndicator.style.left = (activeOutSec / video.duration) * 100 + '%'; } }
    else { if (outIndicator) outIndicator.style.display = 'none'; }
    if (activeSwapSec !== null) { if (swapInd2) { swapInd2.style.display = 'block'; swapInd2.style.left = (activeSwapSec / video.duration) * 100 + '%'; } }
    else { if (swapInd2) swapInd2.style.display = 'none'; }
}

// ── Render Settings Panel ─────────────────────────────────────
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
    if (lAction) lAction.innerText = `TAG (${formatShortcutDisplay(shortcuts.action)}):`;
    if (lScript) lScript.innerText = `SCRIPT (${formatShortcutDisplay(shortcuts.script)}):`;
    if (lNote)   lNote.innerText   = `NOTE (${formatShortcutDisplay(shortcuts.note)}):`;
    if (uText)   uText.innerText   = `Click or press '${formatShortcutDisplay(shortcuts.video)}' to upload a video file`;

    // Google Sheets URL input
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

    // Google Client ID input
    const googleClientIdInput = document.getElementById('googleClientIdInput');
    if (googleClientIdInput) {
        googleClientIdInput.value = googleClientId;
        if (!googleClientIdInput.dataset.hasListener) {
            googleClientIdInput.dataset.hasListener = "true";
            googleClientIdInput.addEventListener('input', e => {
                googleClientId = e.target.value.trim();
                localStorage.setItem('autoscript_google_client_id', googleClientId);
            });
        }
    }
}

// ── Render Feedback Feed ──────────────────────────────────────
window.renderFeedbackFeed = function() {
    const fb = document.getElementById('feedbackContainer');
    const tw = document.querySelector('.table-wrap');
    const sb = document.getElementById('storyboardContainer');
    if (!fb) return;
    
    // Hide table and storyboard
    if (tw) tw.style.display = 'none';
    if (sb) sb.style.display = 'none';
    fb.style.display = 'flex';
    
    // Reset contents
    fb.innerHTML = '';
    let count = 0;
    const currentFilter = document.getElementById('filterAction') ? document.getElementById('filterAction').value : 'ALL';
    const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';

    logs.forEach((log, index) => {
        // Apply filters
        if (!log.isFeedback) return;
        if (currentFilter !== 'ALL' && log.action !== currentFilter) return;
        
        let searchableStr = `${log.script || ''} ${log.note || ''} ${log.reviewNote || ''} ${log.tcin || ''} ${log.tcout || ''}`.toLowerCase();
        if (searchQuery && !searchableStr.includes(searchQuery)) return;
        
        count++;
        
        const outVal  = log.tcout === '00:00:00:00' ? '' : log.tcout;
        
        let thumbCell = '';
        if (log.thumb) {
            thumbCell = `<div class="feedback-card-thumb"><img src="${log.thumb}" alt="thumb" onclick="window.openAnnotationModal(event, ${index})" style="cursor:pointer;"></div>`;
        }
        
        const currentStatus = log.status || 'pending';
        let statusColor = 'var(--text-muted)';
        let statusBorderColor = 'var(--border)';
        if (currentStatus === 'approved') { statusColor = '#22c55e'; statusBorderColor = '#22c55e'; }
        if (currentStatus === 'needs_fix') { statusColor = '#ef4444'; statusBorderColor = '#ef4444'; }

        const statusSelect = `
            <select onchange="window.updateRowStatus(${index}, this.value); event.stopPropagation();" style="padding:2px 8px; font-size:10px; font-weight:700; background:transparent; color:${statusColor}; border:1px solid ${statusBorderColor}; border-radius:4px; outline:none; cursor:pointer;">
                <option value="pending" style="color:#000;" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="approved" style="color:#000;" ${currentStatus === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="needs_fix" style="color:#000;" ${currentStatus === 'needs_fix' ? 'selected' : ''}>Needs Fix</option>
            </select>
        `;

        const actionBadge = `<span style="font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px; background:var(--bg-input); border:1px solid var(--border-bright); color:var(--text-main);">${escapeHtml(log.action)}</span>`;

        const scriptRef = log.script ? `<div class="feedback-card-script-ref">${escapeHtml(log.script)}</div>` : '';

        const card = document.createElement('div');
        card.className = 'feedback-card';
        card.onclick = () => window.jumpToTC(index, 'tcin');
        
        card.innerHTML = `
            <div class="feedback-card-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:600; color:var(--accent);">${escapeHtml(log.tcin)} ${outVal ? ` - ${escapeHtml(outVal)}` : ''}</span>
                    ${actionBadge}
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${statusSelect}
                    <button class="btn-delete" onclick="event.stopPropagation(); deleteLog(${index});" title="Delete" style="padding:2px 6px; font-size:10px;">&#10006;</button>
                </div>
            </div>
            <div class="feedback-card-body">
                ${thumbCell}
                <div class="feedback-card-content">
                    <div class="feedback-card-text">${escapeHtml(log.reviewNote) || '<em style="color:var(--text-muted);font-size:12px;">(No review comment)</em>'}</div>
                    ${scriptRef}
                </div>
            </div>
        `;
        
        fb.appendChild(card);
    });
    
    // Update count display
    const countBadge = document.getElementById('logCount');
    if (countBadge) countBadge.textContent = count;
};
