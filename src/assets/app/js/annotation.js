// ============================================================
//  AUTOSCRIPT TCP Pro — annotation.js
//  Video Frame Annotation Logic
// ============================================================

(function() {
    let modal, canvas, ctx;
    let isDrawing = false;
    let currentColor = '#ef4444';
    let currentLogIndex = null;
    let baseImage = null;
    
    // History for undo
    let drawHistory = [];

    function initAnnotation() {
        modal = document.getElementById('annotationModal');
        canvas = document.getElementById('annotationCanvas');
        if (!modal || !canvas) return;
        
        ctx = canvas.getContext('2d');
        
        // Buttons
        document.getElementById('btnAnnotationClose').addEventListener('click', closeAnnotation);
        document.getElementById('btnAnnotationCancel').addEventListener('click', closeAnnotation);
        document.getElementById('btnAnnotationSave').addEventListener('click', saveAnnotation);
        document.getElementById('btnAnnotationUndo').addEventListener('click', undoAnnotation);
        document.getElementById('btnAnnotationClear').addEventListener('click', clearAnnotation);
        
        // Color Picker
        const colorBtns = modal.querySelectorAll('.color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                colorBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.borderColor = 'transparent';
                });
                e.target.classList.add('active');
                e.target.style.borderColor = 'white';
                currentColor = e.target.dataset.color;
            });
        });

        // Mouse Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch Events
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
    }

    function saveStateToHistory() {
        if (!canvas) return;
        drawHistory.push(canvas.toDataURL());
    }

    function undoAnnotation() {
        if (drawHistory.length > 0) {
            drawHistory.pop(); // remove current state
            if (drawHistory.length > 0) {
                const imgData = drawHistory[drawHistory.length - 1];
                restoreCanvasFromDataUrl(imgData);
            } else {
                // If history is empty after popping, redraw base image
                redrawBaseImage();
            }
        } else {
            redrawBaseImage();
        }
    }

    function clearAnnotation() {
        redrawBaseImage();
        saveStateToHistory();
    }

    function redrawBaseImage() {
        if (!baseImage || !canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    }

    function restoreCanvasFromDataUrl(dataUrl) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = dataUrl;
    }

    // Drawing Logic
    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        // Calculate scale factor since canvas might be styled with max-width/max-height
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const pos = getPointerPos(touch);
            initDrawing(pos.x, pos.y);
        }
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (isDrawing && e.touches.length > 0) {
            const touch = e.touches[0];
            const pos = getPointerPos(touch);
            continueDrawing(pos.x, pos.y);
        }
    }

    function startDrawing(e) {
        const pos = getPointerPos(e);
        initDrawing(pos.x, pos.y);
    }

    function initDrawing(x, y) {
        isDrawing = true;
        saveStateToHistory(); // Save state before this new stroke
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 4;
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getPointerPos(e);
        continueDrawing(pos.x, pos.y);
    }

    function continueDrawing(x, y) {
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        if (isDrawing) {
            ctx.closePath();
            isDrawing = false;
        }
    }

    // Public API
    window.openAnnotationModal = function(logIndex) {
        if (typeof logIndex !== 'number' || logIndex < 0 || logIndex >= logs.length) return;
        
        const log = logs[logIndex];
        if (!log.thumb) {
            if (window.showToast) window.showToast('Không có hình ảnh để ghi chú', 'error');
            return;
        }
        
        currentLogIndex = logIndex;
        drawHistory = [];
        
        // Load image onto canvas
        baseImage = new Image();
        baseImage.onload = () => {
            if (!canvas) initAnnotation(); // Ensure initialized
            
            // Set canvas resolution to image intrinsic size for high quality
            canvas.width = baseImage.width;
            canvas.height = baseImage.height;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(baseImage, 0, 0);
            
            modal.style.display = 'flex';
        };
        baseImage.src = log.thumb;
    };

    function closeAnnotation() {
        if (modal) modal.style.display = 'none';
        currentLogIndex = null;
        baseImage = null;
        drawHistory = [];
    }

    function saveAnnotation() {
        if (currentLogIndex === null || !canvas) return;
        
        // Save canvas drawing back to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        logs[currentLogIndex].thumb = dataUrl;
        
        // Re-render and save
        saveSession();
        if (typeof renderTable === 'function') renderTable();
        
        closeAnnotation();
        if (window.showToast) window.showToast('Đã lưu ghi chú hình ảnh', 'success');
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAnnotation, 500); // Wait for injection
    });
})();
