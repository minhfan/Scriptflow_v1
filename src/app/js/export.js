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
