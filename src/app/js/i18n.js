// ── INTERNATIONALIZATION (i18n) CORE ─────────────────────────
// Dictionary for ENG and VIE

const translations = {
    ENG: {
        'lbl_tag': 'TAG (T):',
        'lbl_script': 'SCRIPT (S):',
        'lbl_note': 'NOTE (N):',
        'btn_add_preset': '+ Add Preset',
        'btn_export': 'Export',
        'opt_all_actions': 'All tags',
        'col_stt': 'NO',
        'col_tag': 'TAG',
        'col_in': 'TC IN',
        'col_out': 'TC OUT',
        'col_swap': 'TC SWAP',
        'col_script': 'SCRIPT',
        'col_note': 'NOTE',
        'msg_upload_video': "Click or press 'V' to upload a video file",
        'msg_del_tag_title': 'Delete Tag',
        'msg_del_tag_body': 'Are you sure you want to delete this tag from the current preset?',
        'msg_del_preset_title': 'Delete Preset',
        'msg_del_preset_body': 'Are you sure you want to delete this preset?',
        'prompt_new_preset': 'Enter new Preset name:',
        'prompt_new_tag': 'Enter new Tag name...',
        'btn_settings': 'Settings',
        'btn_shortcuts': 'Shortcuts',
        'lang_toggle': 'VIE',
        'btn_cancel': 'Cancel',
        'btn_ok': 'OK'
    },
    VIE: {
        'lbl_tag': 'TAG (T):',
        'lbl_script': 'KỊCH BẢN (S):',
        'lbl_note': 'GHI CHÚ (N):',
        'btn_add_preset': '+ Thêm Preset',
        'btn_export': 'Xuất File',
        'opt_all_actions': 'Tất cả tag',
        'col_stt': 'STT',
        'col_tag': 'TAG',
        'col_in': 'VÀO',
        'col_out': 'RA',
        'col_swap': 'CHUYỂN',
        'col_script': 'KỊCH BẢN',
        'col_note': 'GHI CHÚ',
        'msg_upload_video': "Click hoặc nhấn 'V' để tải file video",
        'msg_del_tag_title': 'Xóa Tag',
        'msg_del_tag_body': 'Bạn có chắc muốn xóa tag này khỏi preset hiện tại không?',
        'msg_del_preset_title': 'Xóa Preset',
        'msg_del_preset_body': 'Bạn có muốn xóa preset này?',
        'prompt_new_preset': 'Nhập tên Preset mới:',
        'prompt_new_tag': 'Tên Tag mới...',
        'btn_settings': 'Cài Đặt',
        'btn_shortcuts': 'Phím Tắt',
        'lang_toggle': 'ENG',
        'btn_cancel': 'Hủy',
        'btn_ok': 'OK'
    }
};

let currentLanguage = localStorage.getItem('autoscript_language') || 'ENG';

window.setLanguage = function(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('autoscript_language', lang);
        applyTranslations();
        
        // Re-render JS dynamic components
        if (typeof window.renderTable === 'function') window.renderTable();
        if (typeof window.renderTagPresetMenu === 'function') window.renderTagPresetMenu();
        if (typeof window.updateActionButtons === 'function') window.updateActionButtons();
    }
};

window.toggleLanguage = function() {
    setLanguage(currentLanguage === 'ENG' ? 'VIE' : 'ENG');
};

window.t = function(key) {
    return translations[currentLanguage][key] || key;
};

window.applyTranslations = function() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            // Check if element is an input placeholder or text content
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[currentLanguage][key];
            } else {
                // If it has HTML content that we shouldn't overwrite, we need to be careful
                // For simplicity, we just replace innerText, but maybe keep children if needed?
                // For now, we replace innerText unless it's the custom button where we use innerHTML
                el.innerText = translations[currentLanguage][key];
            }
        }
    });
    
    const toggleBtn = document.getElementById('btnLangToggle');
    if (toggleBtn) {
        toggleBtn.innerText = currentLanguage === 'ENG' ? 'ENG' : 'VIE';
        toggleBtn.style.color = currentLanguage === 'ENG' ? '#3b82f6' : '#ef4444';
        toggleBtn.style.borderColor = currentLanguage === 'ENG' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        toggleBtn.style.background = currentLanguage === 'ENG' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    }
};

// Initialize translations on DOM load
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
});
