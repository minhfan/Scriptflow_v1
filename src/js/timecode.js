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
