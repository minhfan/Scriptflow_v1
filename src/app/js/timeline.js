// ============================================================
//  AUTOSCRIPT TCP Pro — timeline.js
//  Zoom control, animated zoom, pan, wheel scroll.
//  Depends on: state.js, renderer.js
// ============================================================

let timelineZoom = 1;
let zoomAnimationId = null;
let currentAnimTarget = null;
let customCenterTime = null;

// ── Core Zoom API ─────────────────────────────────────────────
function applyZoom(newZoom, immediate = false, centerSec = null) {
    if (newZoom < 1)  newZoom = 1;
    if (newZoom > 50) newZoom = 50;

    currentAnimTarget = newZoom;
    customCenterTime  = centerSec;

    if (immediate) {
        if (zoomAnimationId) { cancelAnimationFrame(zoomAnimationId); zoomAnimationId = null; }
        setZoomInstantly(newZoom);
    } else {
        if (!zoomAnimationId) animateZoom();
    }
}

function setZoomInstantly(z) {
    const video   = document.getElementById('videoPlayer');
    const wrapper = document.querySelector('.custom-timeline-wrapper');
    const timeline = document.getElementById('customTimeline');
    const zoomText = document.getElementById('zoomText');
    const btnZoomDrag = document.getElementById('btnZoomDrag');

    timelineZoom = z;
    timeline.style.width    = (timelineZoom * 100) + '%';
    timeline.style.minWidth = (timelineZoom * 100) + '%';

    if (video && video.duration && wrapper && wrapper.offsetWidth > 0) {
        const newTimelineWidth = wrapper.clientWidth * timelineZoom;
        const centerTime = customCenterTime !== null ? customCenterTime : video.currentTime;
        const playheadX  = (centerTime / video.duration) * newTimelineWidth;
        wrapper.scrollLeft = playheadX - (wrapper.offsetWidth / 2);
    }

    if (zoomText) zoomText.innerText = timelineZoom.toFixed(2) + 'x';

    if (btnZoomDrag) {
        if (timelineZoom > 1) {
            btnZoomDrag.style.color      = '#60a5fa';
            btnZoomDrag.style.textShadow = '0 0 8px rgba(96,165,250,0.5)';
        } else {
            btnZoomDrag.style.color      = '';
            btnZoomDrag.style.textShadow = '';
        }
    }

    drawMarkers();
    renderTimelineTicks();
}

function animateZoom() {
    const diff = currentAnimTarget - timelineZoom;
    if (Math.abs(diff) < 0.05) {
        setZoomInstantly(currentAnimTarget);
        zoomAnimationId = null;
        return;
    }
    setZoomInstantly(timelineZoom + diff * 0.2);
    zoomAnimationId = requestAnimationFrame(animateZoom);
}

// ── Init Zoom Drag Button ─────────────────────────────────────
function initZoomDragButton() {
    const btnZoomDrag = document.getElementById('btnZoomDrag');
    if (!btnZoomDrag) return;

    let isZoomDragging = false, startX = 0, startZoom = 1;

    btnZoomDrag.addEventListener('mousedown', (e) => {
        isZoomDragging = false;
        startX    = e.clientX;
        startZoom = timelineZoom;

        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            if (Math.abs(dx) > 3) {
                isZoomDragging = true;
                applyZoom(startZoom + Math.round(dx / 10) * 1, true);
            }
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!isZoomDragging) applyZoom(1); // Click → reset to 1x
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// ── Init Timeline Pan ─────────────────────────────────────────
function initTimelinePan() {
    const wrapper = document.querySelector('.custom-timeline-wrapper');
    if (!wrapper) return;
    let isPanning = false, startPanX = 0, startScrollLeft = 0;

    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.custom-timeline')) return;
        isPanning = true;
        startPanX      = e.clientX;
        startScrollLeft = wrapper.scrollLeft;
        wrapper.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        wrapper.scrollLeft = startScrollLeft - (e.clientX - startPanX);
    });
    window.addEventListener('mouseup', () => {
        if (isPanning) { isPanning = false; wrapper.style.cursor = ''; }
    });
}

// ── Init Timeline Wheel Zoom ──────────────────────────────────
function initTimelineWheel() {
    const timeline = document.getElementById('customTimeline');
    if (!timeline) return;
    timeline.addEventListener('wheel', (e) => {
        const video = document.getElementById('videoPlayer');
        if (!video || !video.duration || e.deltaY === 0) return;
        e.preventDefault();
        const baseZoom = zoomAnimationId ? currentAnimTarget : timelineZoom;
        const newZoom  = Math.max(1, Math.min(50, baseZoom + e.deltaY * -0.05));
        if (newZoom !== currentAnimTarget) applyZoom(newZoom);
    }, { passive: false });
}

// ── Init Scrub ────────────────────────────────────────────────
function initTimelineScrub() {
    const timeline = document.getElementById('customTimeline');
    const wrapper  = document.querySelector('.custom-timeline-wrapper');
    if (!timeline || !wrapper) return;

    let isScrubbing = false;

    function updateScrub(e) {
        const video = document.getElementById('videoPlayer');
        const bigTc = document.getElementById('bigTimecode');
        if (!video || !video.duration) return;
        const rect = timeline.getBoundingClientRect();
        const xPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct  = (xPos / rect.width) * 100;
        const ct   = (xPos / rect.width) * video.duration;
        const timelineProgress = document.getElementById('timelineProgress');
        const playhead = document.getElementById('playheadIndicator');
        if (timelineProgress) timelineProgress.style.width = pct + '%';
        if (playhead) playhead.style.left = pct + '%';
        if (bigTc) bigTc.innerText = formatTC(ct);
        video.currentTime = ct;
    }

    timeline.addEventListener('mousedown', e => {
        e.preventDefault();
        const video = document.getElementById('videoPlayer');
        if (!video || !video.duration) return;
        isScrubbing = true;
        updateScrub(e);
    });
    window.addEventListener('mousemove', e => { if (isScrubbing) updateScrub(e); });
    window.addEventListener('mouseup', e => {
        if (isScrubbing) { isScrubbing = false; updateScrub(e); }
    });

    // Hover tooltip
    timeline.addEventListener('mousemove', e => {
        const video   = document.getElementById('videoPlayer');
        const tooltip = document.getElementById('hoverTooltip');
        if (!video || !video.duration || !tooltip) { if (tooltip) tooltip.style.display = 'none'; return; }
        const rect = wrapper.getBoundingClientRect();
        const xPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        tooltip.style.display = 'block';
        tooltip.style.left    = xPos + 'px';
        tooltip.innerText     = formatTC((xPos / rect.width) * video.duration);
    });
    timeline.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('hoverTooltip');
        if (tooltip) tooltip.style.display = 'none';
    });
}
