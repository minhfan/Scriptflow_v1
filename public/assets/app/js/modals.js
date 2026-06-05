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
