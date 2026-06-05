// ============================================================
//  AUTOSCRIPT TCP Pro — modals.js
//  openMessageModal, closeMessageModal, openConfirmModal,
//  showRowMenu, hideContextMenu
//  Depends on: state.js
// ============================================================

// ── Message Modal ─────────────────────────────────────────────
function closeMessageModal() {
    const mMessage = document.getElementById('messageModal');
    if (mMessage) mMessage.style.display = 'none';
}

function openMessageModal(title, message) {
    const mMessage     = document.getElementById('messageModal');
    const titleEl      = document.getElementById('messageModalTitle');
    const bodyEl       = document.getElementById('messageModalBody');
    if (!mMessage || !titleEl || !bodyEl) {
        console.warn('[Modal fallback]', title, message);
        return;
    }
    titleEl.innerText = title   || 'Thông báo';
    bodyEl.innerText  = message || '';
    mMessage.style.display = 'flex';
}

// ── Toast Notifications (Auto-hiding) ─────────────────────────
window.showToast = function(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ── Confirm Modal (Promise-based) ─────────────────────────────
function openConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal     = document.getElementById('confirmModal');
        const titleEl   = document.getElementById('confirmModalTitle');
        const bodyEl    = document.getElementById('confirmModalBody');
        const btnOK     = document.getElementById('btnConfirmOK');
        const btnCancel = document.getElementById('btnConfirmCancel');
        if (!modal || !titleEl || !bodyEl) { resolve(confirm(message)); return; }

        titleEl.innerText = title   || 'Xác nhận';
        bodyEl.innerText  = message || '';
        modal.style.display = 'flex';

        function cleanup() {
            modal.style.display = 'none';
            btnOK.removeEventListener('click', onOK);
            btnCancel.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
        }
        function onOK()      { cleanup(); resolve(true); }
        function onCancel()  { cleanup(); resolve(false); }
        function onBackdrop(e) { if (e.target === modal) { cleanup(); resolve(false); } }

        btnOK.addEventListener('click', onOK);
        btnCancel.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
    });
}

// ── Floating Confirm (Promise-based) ──────────────────────────
window.openFloatingConfirm = function(e, message) {
    return new Promise((resolve) => {
        let popover = document.getElementById('floatingConfirmPopover');
        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'floatingConfirmPopover';
            popover.className = 'floating-confirm-popover';
            document.body.appendChild(popover);
        }

        popover.innerHTML = `
            <div class="fc-message">${message}</div>
            <div class="fc-actions">
                <button class="fc-btn fc-cancel">${window.t ? window.t('btn_cancel') : 'Hủy'}</button>
                <button class="fc-btn fc-ok">OK</button>
            </div>
        `;

        popover.style.display = 'flex';
        
        // Position it near the mouse
        let x = e.clientX + 10;
        let y = e.clientY + 10;
        
        // Ensure it doesn't go off screen
        const rect = popover.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;
        
        popover.style.left = x + 'px';
        popover.style.top = y + 'px';
        
        // Add animation class
        popover.classList.add('menu-animated');

        const btnOk = popover.querySelector('.fc-ok');
        const btnCancel = popover.querySelector('.fc-cancel');

        function cleanup() {
            popover.style.display = 'none';
            document.removeEventListener('click', onOutsideClick);
        }

        function onOutsideClick(evt) {
            if (!popover.contains(evt.target)) {
                cleanup();
                resolve(false);
            }
        }

        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
        
        // Prevent immediate close
        setTimeout(() => {
            document.addEventListener('click', onOutsideClick);
        }, 10);
    });
};

// ── Action Tag Context Menu ───────────────────────────────────
window.openActionTagMenu = function(e, actionName, currentColorHex) {
    return new Promise((resolve) => {
        let menu = document.getElementById('actionTagMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'actionTagMenu';
            menu.className = 'floating-confirm-popover';
            menu.style.flexDirection = 'column';
            menu.style.gap = '10px';
            menu.style.padding = '12px';
            menu.style.minWidth = '200px';
            document.body.appendChild(menu);
        }

        const presetColors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e', 
            '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'
        ];

        let colorsHtml = presetColors.map(hex => `
            <div class="color-swatch" data-color="${hex}" style="width: 24px; height: 24px; border-radius: 4px; background: ${hex}; cursor: pointer; border: 2px solid ${hex === currentColorHex ? '#fff' : 'transparent'};"></div>
        `).join('');

        menu.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: var(--text-main); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 4px;">
                Cài đặt Tag: <span style="color: var(--accent);">${actionName}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-sub); margin-bottom: 4px;">Chọn màu:</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                ${colorsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px;">
                <button id="btnActionTagDelete" class="fc-btn" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">Xóa Tag</button>
                <button id="btnActionTagCancel" class="fc-btn fc-cancel">Đóng</button>
            </div>
        `;

        menu.style.display = 'flex';
        
        let x = e.clientX + 10;
        let y = e.clientY + 10;
        const rect = menu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('menu-animated');

        function cleanup() {
            menu.style.display = 'none';
            document.removeEventListener('click', onOutsideClick);
        }

        function onOutsideClick(evt) {
            if (!menu.contains(evt.target)) {
                cleanup();
                resolve(null);
            }
        }

        menu.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.onclick = () => {
                cleanup();
                resolve({ type: 'color', color: swatch.getAttribute('data-color') });
            };
        });

        document.getElementById('btnActionTagDelete').onclick = () => { cleanup(); resolve({ type: 'delete' }); };
        document.getElementById('btnActionTagCancel').onclick = () => { cleanup(); resolve(null); };
        
        setTimeout(() => document.addEventListener('click', onOutsideClick), 10);
    });
};

// ── Image Preview Modal ───────────────────────────────────────
let isImagePreviewZoomed = false;

window.openAnnotationModal = function(e, index) {
    if (e && e.stopPropagation) e.stopPropagation();
    const log = logs[index];
    if (!log || (!log.thumb && !log.drawing)) return;
    
    const modal = document.getElementById('imagePreviewModal');
    const content = document.getElementById('imagePreviewContent');
    const img = document.getElementById('imagePreviewImg');
    const btn = document.getElementById('btnJumpFromPreview');
    const dragHandle = document.getElementById('imagePreviewDragHandle');
    
    if (modal && img && content) {
        img.src = log.thumb || log.drawing;
        modal.style.display = 'block';
        
        // Reset zoom
        isImagePreviewZoomed = false;
        img.style.width = '480px';
        img.style.cursor = 'zoom-in';
        
        // Position at cursor
        let x = e ? e.clientX + 10 : window.innerWidth / 2 - 240;
        let y = e ? e.clientY + 10 : window.innerHeight / 2 - 160;
        
        // Initial positioning before we know true height
        content.style.left = x + 'px';
        content.style.top = y + 'px';
        
        // Adjust if off-screen
        setTimeout(() => {
            const rect = content.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 20;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 20;
            if (x < 0) x = 10;
            if (y < 0) y = 10;
            content.style.left = x + 'px';
            content.style.top = y + 'px';
        }, 10);
        
        // Zoom functionality
        img.onclick = () => {
            const oldWidth = img.offsetWidth;
            const oldHeight = img.offsetHeight;
            let curX = parseInt(content.style.left) || 0;
            let curY = parseInt(content.style.top) || 0;
            let targetWidth;

            if (!isImagePreviewZoomed) {
                targetWidth = 1000;
                img.style.width = targetWidth + 'px';
                img.style.cursor = 'zoom-out';
                isImagePreviewZoomed = true;
            } else {
                targetWidth = 480;
                img.style.width = targetWidth + 'px';
                img.style.cursor = 'zoom-in';
                isImagePreviewZoomed = false;
            }

            // Mathematically center the zoom
            const scaleRatio = targetWidth / oldWidth;
            const targetHeight = oldHeight * scaleRatio;
            const dx = (targetWidth - oldWidth) / 2;
            const dy = (targetHeight - oldHeight) / 2;
            
            curX -= dx;
            curY -= dy;

            // Keep within bounds
            setTimeout(() => {
                const rect = content.getBoundingClientRect();
                if (curX + rect.width > window.innerWidth) curX = window.innerWidth - rect.width - 20;
                if (curY + rect.height > window.innerHeight) curY = window.innerHeight - rect.height - 20;
                if (curX < 0) curX = 10;
                if (curY < 0) curY = 10;
                content.style.left = curX + 'px';
                content.style.top = curY + 'px';
            }, 10);
        };

        // Drag functionality
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            content.style.left = (initialLeft + dx) + 'px';
            content.style.top = (initialTop + dy) + 'px';
        };
        
        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        dragHandle.onmousedown = (downEvent) => {
            isDragging = true;
            startX = downEvent.clientX;
            startY = downEvent.clientY;
            initialLeft = parseInt(content.style.left) || 0;
            initialTop = parseInt(content.style.top) || 0;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
        
        if (btn) {
            btn.onclick = () => {
                modal.style.display = 'none';
                if (window.jumpToTC) window.jumpToTC(index, 'tcin');
            };
        }
    }
};

// ── Row Context Menu ──────────────────────────────────────────
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
        menu.style.left    = e.pageX + 'px';
        menu.style.top     = e.pageY + 'px';
    }
};
