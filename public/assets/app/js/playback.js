// ============================================================
//  AUTOSCRIPT TCP Pro — playback.js
//  Video playback, preview-cut, speed, TC mark/jump.
//  Depends on: state.js, timecode.js, renderer.js, modals.js
// ============================================================

// ── Playback ──────────────────────────────────────────────────
function togglePlayback() {
    const video = document.getElementById('videoPlayer');
    if (video.paused) video.play();
    else video.pause();
}

function updateToolbarPlayState() {
    const video = document.getElementById('videoPlayer');
    const btnPlayVideo   = document.getElementById('btnPlayVideo');
    const btnPlayReverse = document.getElementById('btnPlayReverse');
    if (!btnPlayVideo) return;
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

function endPreview() {
    const btnPreviewCut = document.getElementById('btnPreviewCut');
    if (previewState.restorePreviewCut) {
        isPreviewCut = originalPreviewCutState;
        if (btnPreviewCut) {
            btnPreviewCut.classList.toggle('active', isPreviewCut);
            btnPreviewCut.title = isPreviewCut ? 'Preview Cut: ON (P)' : 'Preview Cut: OFF (P)';
        }
        previewState.restorePreviewCut = false;
    }
    previewState.active = false;
}

function togglePreviewCut() {
    const btnPreviewCut = document.getElementById('btnPreviewCut');
    isPreviewCut = !isPreviewCut;
    if (btnPreviewCut) {
        btnPreviewCut.classList.toggle('active', isPreviewCut);
        btnPreviewCut.title = isPreviewCut ? 'Preview Cut: ON (P)' : 'Preview Cut: OFF (P)';
    }
}

window.playActionPreview = function(index) {
    const video = document.getElementById('videoPlayer');
    const btnPreviewCut = document.getElementById('btnPreviewCut');
    const log = logs[index];
    if (!log) return;

    originalPreviewCutState = isPreviewCut;
    if (!isPreviewCut) {
        isPreviewCut = true;
        if (btnPreviewCut) { btnPreviewCut.classList.add('active'); btnPreviewCut.title = 'Preview Cut: ON (P)'; }
    }

    previewState.active = true;
    previewState.logIndex = index;
    previewState.restorePreviewCut = true;

    const iSec = Number.isFinite(log.inSec)   ? log.inSec   : parseTC(log.tcin);
    const oSec = Number.isFinite(log.outSec)   ? log.outSec  : parseTC(log.tcout);
    const sSec = (log.action === 'SWAP' && Number.isFinite(log.swapSec)) ? log.swapSec : parseTC(log.tcswap || '');

    if (log.action === 'SWAP' && Number.isFinite(sSec) && sSec > 0) {
        previewState.phase = 1;
        video.currentTime = Math.max(0, sSec - 2);
    } else if (log.action === 'DELETE') {
        previewState.phase = 0;
        video.currentTime = Math.max(0, iSec - 2);
    } else {
        previewState.phase = 0;
        video.currentTime = Number.isFinite(iSec) ? Math.max(0, iSec - 2) : 0;
    }
    video.play();

    let pts = [];
    if (Number.isFinite(iSec)) pts.push(iSec);
    if (Number.isFinite(oSec) && oSec > 0) pts.push(oSec);
    if (log.action === 'SWAP' && Number.isFinite(sSec) && sSec > 0) pts.push(sSec);
    let centerSec = iSec || 0;
    let targetZoom = 50;
    if (pts.length >= 2) {
        const minSec = Math.min(...pts);
        const maxSec = Math.max(...pts);
        const validDur = maxSec - minSec;
        if (validDur > 0) {
            targetZoom = Math.max(1, Math.min(50, video.duration / (validDur * 3)));
            centerSec  = minSec + validDur / 2;
        }
    }
    applyZoom(targetZoom, false, centerSec);
};

// ── TC IN / OUT / SWAP ────────────────────────────────────────
function markInPoint() {
    const video   = document.getElementById('videoPlayer');
    const valTcIn = document.getElementById('valTcIn');
    const boxIn   = document.getElementById('boxIn');
    const boxOut  = document.getElementById('boxOut');
    const valTcOut = document.getElementById('valTcOut');
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeInSec = video.currentTime;
        if (valTcIn) valTcIn.innerText = formatTC(activeInSec);
        logs[editingRowIndex].inSec = activeInSec;
        logs[editingRowIndex].tcin  = formatTC(activeInSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) { const cells = row.querySelectorAll('td'); if (cells[4]) cells[4].innerText = formatTC(activeInSec); }
        drawMarkers(); updateActiveRange(); return;
    }
    if (activeInSec !== null) {
        activeInSec = null;
        if (boxIn) boxIn.classList.remove('active');
        if (valTcIn) valTcIn.innerText = formatTC(video.currentTime);
        updateActiveRange(); return;
    }
    activeInSec = video.currentTime;
    if (activeOutSec !== null && activeOutSec <= activeInSec) {
        activeOutSec = null;
        if (valTcOut) valTcOut.innerText = formatTC(video.currentTime);
        if (boxOut) boxOut.classList.remove('active');
    }
    if (valTcIn) valTcIn.innerText = formatTC(activeInSec);
    if (boxIn) boxIn.classList.add('active');
    updateActiveRange();
}

function markOutPoint() {
    const video    = document.getElementById('videoPlayer');
    const valTcOut = document.getElementById('valTcOut');
    const valTcIn  = document.getElementById('valTcIn');
    const boxOut   = document.getElementById('boxOut');
    const boxIn    = document.getElementById('boxIn');
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeOutSec = video.currentTime;
        if (valTcOut) valTcOut.innerText = formatTC(activeOutSec);
        logs[editingRowIndex].outSec = activeOutSec;
        logs[editingRowIndex].tcout  = formatTC(activeOutSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) { const cells = row.querySelectorAll('td'); if (cells[5]) cells[5].innerText = formatTC(activeOutSec); }
        drawMarkers(); updateActiveRange(); return;
    }
    if (activeOutSec !== null) {
        activeOutSec = null;
        if (boxOut) boxOut.classList.remove('active');
        if (valTcOut) valTcOut.innerText = formatTC(video.currentTime);
        updateActiveRange(); return;
    }
    activeOutSec = video.currentTime;
    if (activeInSec !== null && activeInSec >= activeOutSec) {
        activeInSec = null;
        if (valTcIn) valTcIn.innerText = formatTC(video.currentTime);
        if (boxIn) boxIn.classList.remove('active');
    }
    if (valTcOut) valTcOut.innerText = formatTC(activeOutSec);
    if (boxOut) boxOut.classList.add('active');
    updateActiveRange();
}

function markSwapPoint() {
    const video     = document.getElementById('videoPlayer');
    const valTcSwap = document.getElementById('valTcSwap');
    const boxSwap   = document.getElementById('boxSwap');
    if (!video.duration) return;
    if (editingRowIndex !== null) {
        activeSwapSec = video.currentTime;
        if (valTcSwap) valTcSwap.innerText = formatTC(activeSwapSec);
        logs[editingRowIndex].swapSec = activeSwapSec;
        logs[editingRowIndex].tcswap  = formatTC(activeSwapSec);
        const row = document.getElementById(`row-${editingRowIndex}`);
        if (row) { const cells = row.querySelectorAll('td'); if (cells[3]) cells[3].innerText = formatTC(activeSwapSec); }
        drawMarkers(); updateActiveRange(); return;
    }
    if (activeSwapSec !== null) {
        activeSwapSec = null;
        if (boxSwap) boxSwap.classList.remove('active');
        if (valTcSwap) valTcSwap.innerText = formatTC(video.currentTime);
        updateActiveRange(); return;
    }
    activeSwapSec = video.currentTime;
    if (valTcSwap) valTcSwap.innerText = formatTC(activeSwapSec);
    if (boxSwap) boxSwap.classList.add('active');
    updateActiveRange();
}

// ── Jump Marker ───────────────────────────────────────────────
function jumpMarker(direction) {
    const video = document.getElementById('videoPlayer');
    if (!logs.length) return;
    const sorted = [...logs].sort((a, b) => a.inSec - b.inSec);
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

function skipTime(seconds) {
    const video = document.getElementById('videoPlayer');
    if (!video.duration) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

// ── TC jump deselect on play/seek ────────────────────────────
function clearAutoSelectedTC() {
    const video    = document.getElementById('videoPlayer');
    const valTcIn  = document.getElementById('valTcIn');
    const valTcOut = document.getElementById('valTcOut');
    const valTcSwap = document.getElementById('valTcSwap');
    const boxIn    = document.getElementById('boxIn');
    const boxOut   = document.getElementById('boxOut');
    const boxSwap  = document.getElementById('boxSwap');
    activeInSec = null; activeOutSec = null; activeSwapSec = null;
    if (valTcIn)  valTcIn.innerText  = formatTC(video.currentTime);
    if (valTcOut) valTcOut.innerText = formatTC(video.currentTime);
    if (valTcSwap) valTcSwap.innerText = formatTC(video.currentTime);
    if (boxIn)  boxIn.classList.remove('active');
    if (boxOut) boxOut.classList.remove('active');
    if (boxSwap) boxSwap.classList.remove('active');
    updateActiveRange();
    tcAutoSelected = false;
}

// ── TC Jump Overlay ───────────────────────────────────────────
function showTimecodeJump() {
    const video   = document.getElementById('videoPlayer');
    const overlay = document.getElementById('tcJumpOverlay');
    const input   = document.getElementById('tcJumpInput');
    const bigTc   = document.getElementById('bigTimecode');
    if (!overlay || !input) return;
    overlay.style.display = 'flex';
    if (bigTc) input.value = bigTc.innerText;
    input.focus(); input.select();
}

function hideTimecodeJump() {
    const overlay = document.getElementById('tcJumpOverlay');
    if (overlay) overlay.style.display = 'none';
}

function executeTimecodeJump() {
    const video = document.getElementById('videoPlayer');
    const input = document.getElementById('tcJumpInput');
    if (!input) return;
    const sec = parseTC(input.value);
    if (sec > 0 && sec <= video.duration) video.currentTime = sec;
    hideTimecodeJump();
}

// ── Update Action Buttons ─────────────────────────────────────
function updateActionButtons() {
    const group = document.getElementById('actionButtonGroup');
    const filterSelect = document.getElementById('filterAction');
    
    // Always rebuild buttons to support drag & drop listeners and dynamic adding
    if (group) {
        group.innerHTML = '';
        
        let draggedBtn = null;
        
        actionList.forEach((action, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'action-button';
            btn.dataset.action = action;
            btn.dataset.index = index;
            btn.setAttribute('role', 'radio');
            btn.draggable = true;
            
            // Apply colors and active state immediately
            const colorSet = actionColors[action] || { bg: '#1e293b', color: '#e2e8f0' };
            const active   = action === selectedAction;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
            btn.style.setProperty('--action-bg', colorSet.bg);
            btn.style.setProperty('--action-color', colorSet.color);
            
            btn.addEventListener('click', () => setSelectedAction(action));
            
            // Drag and Drop Listeners
            btn.addEventListener('dragstart', (e) => {
                draggedBtn = btn;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => btn.classList.add('dragging'), 0);
            });
            // Remove right-click to delete, replace with inline 'x' button -> REVERTED to floating context menu
            const nameSpan = document.createElement('span');
            nameSpan.innerText = action;
            btn.appendChild(nameSpan);
            
            btn.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const message = window.t ? window.t('msg_del_tag_body') : `Bạn có chắc muốn xóa tag "${action}" khỏi preset hiện tại không?`;
                const confirmed = await openFloatingConfirm(e, message);
                
                if (confirmed) {
                    const newActionList = actionList.filter(a => a !== action);
                    const newColors = { ...actionColors };
                    delete newColors[action];
                    if (window.updateCurrentPreset) {
                        window.updateCurrentPreset(newActionList, newColors);
                        updateActionButtons();
                    }
                }
            });
            
            btn.addEventListener('dragend', () => {
                btn.classList.remove('dragging');
                draggedBtn = null;
                document.querySelectorAll('.action-button').forEach(b => b.classList.remove('drag-over'));
            });
            
            btn.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (btn !== draggedBtn) btn.classList.add('drag-over');
            });
            
            btn.addEventListener('dragleave', () => {
                btn.classList.remove('drag-over');
            });
            
            btn.addEventListener('drop', (e) => {
                e.preventDefault();
                btn.classList.remove('drag-over');
                if (draggedBtn && draggedBtn !== btn) {
                    const fromIndex = parseInt(draggedBtn.dataset.index);
                    const toIndex = parseInt(btn.dataset.index);
                    
                    // Reorder the array
                    const newActionList = [...actionList];
                    const [moved] = newActionList.splice(fromIndex, 1);
                    newActionList.splice(toIndex, 0, moved);
                    
                    // Update state globally
                    if (window.updateCurrentPreset) {
                        window.updateCurrentPreset(newActionList, actionColors);
                        updateActionButtons();
                    }
                }
            });
            
            group.appendChild(btn);
        });
        
        // Add the inline '+' button at the end
        const btnAdd = document.createElement('button');
        btnAdd.type = 'button';
        btnAdd.className = 'action-button btn-add-action';
        btnAdd.title = 'Add New Action';
        btnAdd.innerText = '+';
        btnAdd.addEventListener('click', (e) => {
            const parent = btnAdd.parentNode;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'action-button';
            input.placeholder = window.t ? window.t('prompt_new_tag') || 'Tên Tag...' : 'Tên Tag...';
            input.style.minWidth = '100px';
            input.style.textAlign = 'center';
            input.style.cursor = 'text';
            input.style.background = 'rgba(0,0,0,0.5)';
            input.style.color = '#fff';
            input.style.border = '1px solid var(--accent)';
            
            parent.replaceChild(input, btnAdd);
            input.focus();
            
            let isFinalized = false;
            
            function finalize() {
                if (isFinalized) return;
                isFinalized = true;
                
                const actionName = input.value.trim().toUpperCase();
                if (actionName && !actionList.includes(actionName)) {
                    const newActionList = [...actionList, actionName];
                    const newColors = { ...actionColors, [actionName]: { bg: '#3b82f6', color: '#ffffff' } };
                    if (window.updateCurrentPreset) {
                        window.updateCurrentPreset(newActionList, newColors);
                        updateActionButtons();
                    }
                } else if (actionList.includes(actionName)) {
                    if (window.showToast) window.showToast('Tag đã tồn tại!', 'error');
                    parent.replaceChild(btnAdd, input);
                } else {
                    parent.replaceChild(btnAdd, input);
                }
            }
            
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') finalize();
                if (evt.key === 'Escape') {
                    isFinalized = true;
                    parent.replaceChild(btnAdd, input);
                }
            });
            input.addEventListener('blur', finalize);
        });
        group.appendChild(btnAdd);
    }

    // Rebuild filter dropdown if needed
    if (filterSelect) {
        const currentOptions = Array.from(filterSelect.options).map(o => o.value).filter(v => v !== 'ALL');
        if (currentOptions.join(',') !== actionList.join(',')) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="ALL">All actions</option>';
            actionList.forEach(action => {
                const opt = document.createElement('option');
                opt.value = action;
                opt.innerText = action;
                filterSelect.appendChild(opt);
            });
            if (actionList.includes(currentVal) || currentVal === 'ALL') {
                filterSelect.value = currentVal;
            } else {
                filterSelect.value = 'ALL';
                filterQuery = 'ALL';
            }
        }
    }
}

function setSelectedAction(action) {
    if (!actionColors[action]) return;
    const video   = document.getElementById('videoPlayer');
    const boxSwap = document.getElementById('boxSwap');
    selectedAction = action;
    updateActionButtons();
    if (boxSwap) boxSwap.style.display = action === 'SWAP' ? 'block' : 'none';
    updateActiveRange();
    if (typeof editingRowIndex !== 'undefined' && editingRowIndex !== null) {
        logs[editingRowIndex].action = action;
        renderTable(); drawMarkers();
    }
}

// ── Custom Tag Preset Menu ────────────────────────────────────
window.renderTagPresetMenu = function() {
    const listEl = document.getElementById('customPresetList');
    const nameEl = document.getElementById('currentPresetName');
    if (!listEl) return;
    
    // Update label
    const currentP = actionPresets[currentPresetId];
    if (nameEl && currentP) nameEl.innerText = currentP.name;
    
    listEl.innerHTML = '';
    
    Object.keys(actionPresets).forEach(id => {
        const p = actionPresets[id];
        
        const item = document.createElement('div');
        item.className = 'preset-item' + (id === currentPresetId ? ' active' : '');
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = p.name;
        item.appendChild(nameSpan);
        
        // Add delete button if custom
        if (!p.isDefault) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete-preset';
            delBtn.innerHTML = '×';
            delBtn.title = 'Delete Preset';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const body = window.t ? window.t('msg_del_preset_body') : 'Bạn có muốn xóa preset này?';
                const confirmed = await openFloatingConfirm(e, body);
                if (confirmed) {
                    delete actionPresets[id];
                    if (currentPresetId === id) {
                        loadActionPreset('default');
                    }
                    localStorage.setItem('autoscript_action_presets', JSON.stringify(actionPresets));
                    window.renderTagPresetMenu();
                    updateActionButtons();
                    renderTable();
                    drawMarkers();
                }
            });
            item.appendChild(delBtn);
        }
        
        item.addEventListener('click', () => {
            loadActionPreset(id);
            updateActionButtons();
            renderTable();
            drawMarkers();
            document.getElementById('btnTagPreset').setAttribute('aria-expanded', 'false');
            document.getElementById('tagPresetMenu').style.display = 'none';
        });
        
        listEl.appendChild(item);
    });
};

// Bind Dropdown Toggle Events
(function initTagPresetMenu() {
    const btnTagPreset = document.getElementById('btnTagPreset');
    const tagMenu = document.getElementById('tagPresetMenu');
    
    if (btnTagPreset && tagMenu) {
        btnTagPreset.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = btnTagPreset.getAttribute('aria-expanded') === 'true';
            btnTagPreset.setAttribute('aria-expanded', String(!expanded));
            tagMenu.style.display = expanded ? 'none' : 'block';
            if (!expanded) window.renderTagPresetMenu();
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!btnTagPreset.contains(e.target) && !tagMenu.contains(e.target)) {
                btnTagPreset.setAttribute('aria-expanded', 'false');
                tagMenu.style.display = 'none';
            }
        });
        
        // Create preset button
        const btnCreatePreset = document.getElementById('btnCreatePreset');
        if (btnCreatePreset) {
            btnCreatePreset.addEventListener('click', (e) => {
                e.stopPropagation();
                // Replace button with an inline input
                const originalText = btnCreatePreset.innerText;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'inline-preset-input';
                input.placeholder = window.t ? window.t('prompt_new_preset') : 'Tên Preset...';
                input.style.width = '100%';
                input.style.padding = '6px';
                input.style.borderRadius = '4px';
                input.style.border = '1px solid var(--accent)';
                input.style.background = 'rgba(0,0,0,0.5)';
                input.style.color = '#fff';
                input.style.fontFamily = 'inherit';
                input.style.fontSize = '12px';
                input.style.outline = 'none';
                
                const parent = btnCreatePreset.parentNode;
                parent.replaceChild(input, btnCreatePreset);
                input.focus();
                
                function finalizeInput() {
                    const name = input.value.trim();
                    if (name) {
                        const newId = 'custom_' + Date.now();
                        actionPresets[newId] = {
                            id: newId,
                            name: name,
                            isDefault: false,
                            actionList: [...actionList],
                            actionColors: { ...actionColors }
                        };
                        localStorage.setItem('autoscript_action_presets', JSON.stringify(actionPresets));
                        loadActionPreset(newId);
                        window.renderTagPresetMenu();
                        updateActionButtons();
                    } else {
                        // Restore button if empty
                        parent.replaceChild(btnCreatePreset, input);
                    }
                }
                
                input.addEventListener('keydown', (evt) => {
                    if (evt.key === 'Enter') finalizeInput();
                    if (evt.key === 'Escape') parent.replaceChild(btnCreatePreset, input);
                });
                
                input.addEventListener('blur', finalizeInput);
            });
        }
    }
    // Global timeupdate listener is bound in init.js or we can bind it here
    const video = document.getElementById('videoPlayer');
    if (video) {
        video.addEventListener('timeupdate', () => {
            if (!logs || logs.length === 0) return;
            const overlay = document.getElementById('playbackAnnotationOverlay');
            if (!overlay) return;
            
            // Find a log with a drawing where current time is between inSec and outSec
            const t = video.currentTime;
            let activeLog = null;
            
            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                if (log.drawing && typeof log.inSec === 'number') {
                    // Default duration to 3 seconds if no outSec is defined
                    const out = (typeof log.outSec === 'number' && log.outSec > log.inSec) ? log.outSec : log.inSec + 3;
                    if (t >= log.inSec && t <= out) {
                        activeLog = log;
                        break;
                    }
                }
            }
            
            if (activeLog && !window.isDrawingOccurred) { // Don't show playback overlay if actively drawing
                if (overlay.src !== activeLog.drawing) {
                    overlay.src = activeLog.drawing;
                }
                overlay.style.display = 'block';
            } else {
                overlay.style.display = 'none';
                overlay.src = '';
            }
        });
    }
})();

// ── Capture Video Frame ──────────────────────────────────────
window.captureVideoFrame = function() {
    const video = document.getElementById('videoPlayer');
    const btn = document.getElementById('btnCaptureFrame');
    if (!video || video.readyState < 2) return;
    
    try {
        const canvas = document.createElement('canvas');
        // Calculate thumbnail size (e.g. max width 160px)
        const maxWidth = 160;
        const scale = maxWidth / video.videoWidth;
        canvas.width = maxWidth;
        canvas.height = video.videoHeight * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Also draw annotation canvas if it's visible or has content
        const annotCanvas = document.getElementById('videoAnnotationCanvas');
        if (annotCanvas && (annotCanvas.style.display !== 'none' || window.isDrawingOccurred)) {
            if (annotCanvas.width > 0 && annotCanvas.height > 0) {
                ctx.drawImage(annotCanvas, 0, 0, canvas.width, canvas.height);
            }
        }
        
        // Generate JPEG data URL to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        activeThumbnail = dataUrl;
        
        // If editing an existing row, auto-update it
        if (typeof editingRowIndex !== 'undefined' && editingRowIndex !== null && logs[editingRowIndex]) {
            logs[editingRowIndex].thumb = dataUrl;
            if (typeof renderTable === 'function') renderTable();
            if (typeof saveSession === 'function') saveSession();
        }
        
        // UI Feedback
        if (btn) {
            btn.style.color = 'var(--accent)';
            btn.style.borderColor = 'var(--accent)';
            setTimeout(() => {
                btn.style.color = 'var(--text-muted)';
                btn.style.borderColor = 'var(--border-bright)';
            }, 500);
        }
        if (window.showToast) window.showToast('Đã chụp thumbnail!', 'success');
    } catch (e) {
        console.error('Lỗi khi chụp frame:', e);
        if (window.showToast) window.showToast('Không thể chụp frame', 'error');
    }
};
