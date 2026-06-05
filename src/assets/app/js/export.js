// ============================================================
//  AUTOSCRIPT TCP Pro — export.js
//  Handles export to XML (Premiere), EDL (Resolve), CSV
// ============================================================

window.handleExport = function(format) {
    if (!logs || logs.length === 0) {
        alert("No logs to export!");
        return;
    }
    
    // Sort logs by time
    const sortedLogs = [...logs].sort((a, b) => a.inSec - b.inSec);
    const projectName = (typeof currentProjectVideoMeta !== 'undefined' && currentProjectVideoMeta && currentProjectVideoMeta.fileName) 
        ? currentProjectVideoMeta.fileName.replace(/\.[^/.]+$/, "") 
        : "Autoscript_Project";

    if (format === 'csv') {
        exportToCSV(sortedLogs, projectName);
    } else if (format === 'xml') {
        exportToXML(sortedLogs, projectName);
    } else if (format === 'edl') {
        exportToEDL(sortedLogs, projectName);
    } else if (format === 'docx') {
        exportToDocx(sortedLogs, projectName);
    } else if (format === 'srt') {
        exportToSRT(sortedLogs, projectName);
    }
};

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── CSV EXPORT ────────────────────────────────────────────────
function exportToCSV(sortedLogs, projectName) {
    let csvContent = "STT,TAG,TC IN,TC OUT,TC SWAP,SCRIPT,NOTE\n";
    sortedLogs.forEach((log, index) => {
        const row = [
            index + 1,
            log.action || '',
            log.tcin || '',
            log.tcout || '',
            log.tcswap || '',
            `"${(log.script || '').replace(/"/g, '""')}"`,
            `"${(log.note || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });
    downloadFile(csvContent, `${projectName}_export.csv`, 'text/csv;charset=utf-8;');
}

// ── XML EXPORT (Premiere Pro / FCP7 Sequence Markers) ─────────
function exportToXML(sortedLogs, projectName) {
    // Current fps from global FPS
    const timebase = Math.round(FPS || 30);
    const isNTSC = (FPS === 29.97 || FPS === 59.94 || FPS === 23.976) ? 'TRUE' : 'FALSE';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${projectName}</name>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>${isNTSC}</ntsc>
    </rate>
    <media>
      <video>
        <track>
        </track>
      </video>
    </media>
`;

    sortedLogs.forEach((log) => {
        const inFrame = Math.round((log.inSec || 0) * FPS);
        const outFrame = log.outSec ? Math.round(log.outSec * FPS) : inFrame + 1;
        const durationFrames = outFrame - inFrame;
        
        const title = `[${log.action}]`;
        const comment = `${log.script || ''} | ${log.note || ''}`;
        const colorHtml = (actionColors && actionColors[log.action]) ? actionColors[log.action].bg : '#ffffff';
        
        xml += `
    <marker>
      <name>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</name>
      <comment>${comment.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</comment>
      <in>${inFrame}</in>
      <out>${outFrame}</out>
    </marker>`;
    });

    xml += `
  </sequence>
</xmeml>`;

    downloadFile(xml, `${projectName}_markers.xml`, 'application/xml');
}

// ── EDL EXPORT (DaVinci Resolve / Standard CMX3600) ───────────
function exportToEDL(sortedLogs, projectName) {
    let edl = `TITLE: ${projectName}\nFCM: NON-DROP FRAME\n\n`;
    
    sortedLogs.forEach((log, index) => {
        const evtNum = String(index + 1).padStart(3, '0');
        const action = log.action || 'NOTE';
        
        // EDL requires valid timecodes. Fallback to start if missing
        const tcIn = log.tcin || '00:00:00:00';
        const tcOut = log.tcout || tcIn;
        
        // standard format: EVENT REEL TRK TRNS DUR TC_IN TC_OUT REC_IN REC_OUT
        // We map sequence markers to a dummy clip
        edl += `${evtNum}  AX       V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}\n`;
        
        // Add marker comment
        const comment = `* LOC: ${tcIn} GREEN ${action}: ${log.script || ''} ${log.note || ''}`.replace(/\n/g, ' ');
        edl += `${comment}\n\n`;
    });
    
    downloadFile(edl, `${projectName}_markers.edl`, 'text/plain');
}

// ── DOCX EXPORT (HTML masquerading as .doc) ───────────────────
function exportToDocx(sortedLogs, projectName) {
    let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <title>${projectName} Script</title>
        <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cccccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f2f2f2; }
            .status-approved { color: green; font-weight: bold; }
            .status-needs_fix { color: red; font-weight: bold; }
            .status-pending { color: gray; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>${projectName} Script</h1>
        <table>
            <tr>
                <th>STT</th>
                <th>Thumbnail</th>
                <th>Status</th>
                <th>Tag</th>
                <th>TC IN</th>
                <th>TC OUT</th>
                <th>Script</th>
                <th>Note</th>
                <th>Review Note</th>
            </tr>`;
    
    sortedLogs.forEach((log, index) => {
        const thumbImg = log.thumb ? `<img src="${log.thumb}" width="100" />` : '';
        const statusStr = log.status || 'pending';
        const statusClass = 'status-' + statusStr;
        const statusText = statusStr === 'needs_fix' ? 'Needs Fix' : statusStr.charAt(0).toUpperCase() + statusStr.slice(1);
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${thumbImg}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${log.action || ''}</td>
                <td>${log.tcin || ''}</td>
                <td>${log.tcout || ''}</td>
                <td>${(log.script || '').replace(/\n/g, '<br>')}</td>
                <td>${(log.note || '').replace(/\n/g, '<br>')}</td>
                <td>${(log.reviewNote || '').replace(/\n/g, '<br>')}</td>
            </tr>`;
    });
    
    html += `
        </table>
    </body>
    </html>`;
    
    downloadFile(html, `${projectName}_Script.doc`, 'application/msword');
}

// ── SRT EXPORT ────────────────────────────────────────────────
function formatSrtTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return '00:00:00,000';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function exportToSRT(sortedLogs, projectName) {
    let srt = '';
    let counter = 1;
    
    sortedLogs.forEach(log => {
        if (!log.script) return; // Skip if no script to show
        
        const inSec = log.inSec || 0;
        const outSec = log.outSec || inSec + 3; // Default 3s duration if no out point
        
        const startStr = formatSrtTime(inSec);
        const endStr = formatSrtTime(outSec);
        
        srt += `${counter}\n`;
        srt += `${startStr} --> ${endStr}\n`;
        srt += `[${log.action}] ${log.script}\n\n`;
        counter++;
    });
    
    if (!srt) {
        if (window.showToast) window.showToast('Không có Script nào để xuất SRT', 'warning');
        return;
    }
    
    downloadFile(srt, `${projectName}_Subtitles.srt`, 'text/plain');
}
