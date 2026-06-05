// ============================================================
//  AUTOSCRIPT TCP Pro — annotation.js
//  Video Frame Annotation Logic (Frame.io Style)
// ============================================================

(function() {
    let canvas, ctx, video;
    let isDrawing = false;
    let isTextTool = false;
    let currentColor = '#ef4444';
    window.isDrawingOccurred = false;

    function initAnnotation() {
        canvas = document.getElementById('videoAnnotationCanvas');
        video = document.getElementById('videoPlayer');
        if (!canvas || !video) return;
        
        ctx = canvas.getContext('2d');
        
        // Buttons
        const undoBtn = document.getElementById('btnAnnotationUndo');
        const clearBtn = document.getElementById('btnAnnotationClear');
        if (undoBtn) undoBtn.addEventListener('click', undoAnnotation);
        if (clearBtn) clearBtn.addEventListener('click', clearAnnotation);
        
        // Color Picker
        const colorBtns = document.querySelectorAll('.color-btn:not(.custom-color)');
        const customColorPicker = document.getElementById('customColorPicker');
        
        const setActiveColorBtn = (target) => {
            colorBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'transparent';
            });
            if (customColorPicker) {
                customColorPicker.classList.remove('active');
                customColorPicker.style.borderColor = 'transparent';
            }
            target.classList.add('active');
            target.style.borderColor = 'white';
        };

        colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                setActiveColorBtn(e.target);
                currentColor = e.target.dataset.color;
            });
        });

        if (customColorPicker) {
            customColorPicker.addEventListener('input', (e) => {
                setActiveColorBtn(customColorPicker);
                currentColor = e.target.value;
            });
            customColorPicker.addEventListener('click', (e) => {
                setActiveColorBtn(customColorPicker);
                currentColor = customColorPicker.value;
            });
        }
        
        // Text Tool
        const textBtn = document.getElementById('btnAnnotationText');
        if (textBtn) {
            textBtn.addEventListener('click', () => {
                isTextTool = !isTextTool;
                textBtn.style.background = isTextTool ? 'var(--accent)' : 'var(--bg-panel)';
                textBtn.style.color = isTextTool ? '#fff' : 'var(--text-main)';
                canvas.style.cursor = isTextTool ? 'text' : 'crosshair';
            });
        }

        // Resize observer to keep canvas matched with video
        const syncCanvasSize = () => {
            const rect = video.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
                    let temp = null;
                    if (window.isDrawingOccurred) temp = canvas.toDataURL();
                    canvas.width = Math.floor(rect.width);
                    canvas.height = Math.floor(rect.height);
                    if (temp) {
                        const img = new Image();
                        img.onload = () => ctx.drawImage(img, 0, 0);
                        img.src = temp;
                    }
                }
            }
        };
        const resizeObserver = new ResizeObserver(syncCanvasSize);
        resizeObserver.observe(video);
        
        // Initial sync
        setTimeout(syncCanvasSize, 100);

        // Mouse Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch Events
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        // Video Events
        video.addEventListener('play', () => {
            clearAnnotation();
            const toolbar = document.getElementById('inlineAnnotationToolbar');
            if (toolbar) toolbar.style.opacity = '0.5';
        });

        video.addEventListener('pause', () => {
            const toolbar = document.getElementById('inlineAnnotationToolbar');
            if (toolbar) toolbar.style.opacity = '1';
        });
        
        video.addEventListener('seeked', () => {
            if (video.paused) {
                clearAnnotation();
            }
        });
    }

    function undoAnnotation() {
        // Since we removed history stack for simplicity in overlay, just clear for now
        // (A full history stack would save toDataURL per stroke)
        clearAnnotation();
    }

    function clearAnnotation() {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        window.isDrawingOccurred = false;
    }

    // Drawing Logic
    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width || 1;
        const scaleY = canvas.height / rect.height || 1;
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
        if (e.target !== canvas) return;
        
        // Prevent default mousedown behavior (which steals focus from our dynamic input)
        if (e.type === 'mousedown') {
            e.preventDefault();
        }
        
        const pos = getPointerPos(e);
        if (isTextTool) {
            addTextInput(pos.x, pos.y);
        } else {
            initDrawing(pos.x, pos.y);
        }
    }

    function initDrawing(x, y) {
        if (!video.paused) {
            video.pause();
        }
        
        // Auto set TC IN if empty
        if (typeof activeInSec !== 'undefined' && activeInSec === null) {
            if (typeof markInPoint === 'function') markInPoint();
        }
        
        window.isDrawingOccurred = true;
        isDrawing = true;
        
        const toolbar = document.getElementById('inlineAnnotationToolbar');
        if (toolbar) toolbar.style.opacity = '1';

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 4;
    }

    function draw(e) {
        if (!isDrawing || isTextTool) return;
        const pos = getPointerPos(e);
        continueDrawing(pos.x, pos.y);
    }

    function continueDrawing(x, y) {
        if (isTextTool) return;
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        if (isDrawing && !isTextTool) {
            ctx.closePath();
            isDrawing = false;
            triggerCapture();
        }
    }
    
    function triggerCapture() {
        // Auto capture frame on mouseup/touchend/text finish
        if (window.isDrawingOccurred && typeof window.captureVideoFrame === 'function') {
            // Throttle capture to avoid lag on multiple rapid strokes
            clearTimeout(window._annotationCaptureTimer);
            window._annotationCaptureTimer = setTimeout(() => {
                window.captureVideoFrame(true);
                // Also capture transparent drawing
                window.activeDrawing = canvas.toDataURL('image/png');
                // If editing an existing row, auto-update it
                if (typeof editingRowIndex !== 'undefined' && editingRowIndex !== null && typeof logs !== 'undefined' && logs[editingRowIndex]) {
                    logs[editingRowIndex].drawing = window.activeDrawing;
                    if (typeof saveSession === 'function') saveSession();
                }
            }, 300);
        }
    }
    
    function addTextInput(x, y) {
        if (!video.paused) {
            video.pause();
        }
        // Auto set TC IN if empty
        if (typeof activeInSec !== 'undefined' && activeInSec === null) {
            if (typeof markInPoint === 'function') markInPoint();
        }
        window.isDrawingOccurred = true;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'absolute';
        input.style.left = x + 'px';
        input.style.top = (y - 10) + 'px'; // Adjust for font size
        input.style.color = currentColor;
        input.style.font = '20px sans-serif';
        input.style.background = 'rgba(0,0,0,0.5)';
        input.style.border = '1px dashed #fff';
        input.style.outline = 'none';
        input.style.padding = '2px 4px';
        input.style.zIndex = '100';
        input.style.minWidth = '50px';
        
        // Append to wrapper
        const wrapper = canvas.parentNode;
        wrapper.appendChild(input);
        input.focus();
        
        const finalizeText = () => {
            if (input.parentNode) {
                const text = input.value.trim();
                if (text) {
                    ctx.font = '20px sans-serif';
                    ctx.fillStyle = currentColor;
                    ctx.fillText(text, x, y + 10);
                    triggerCapture();
                }
                wrapper.removeChild(input);
            }
        };
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finalizeText();
            } else if (e.key === 'Escape') {
                if (input.parentNode) wrapper.removeChild(input);
            }
        });
        
        input.addEventListener('blur', finalizeText);
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAnnotation, 500); // Wait for injection
    });
})();
