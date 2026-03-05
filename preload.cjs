const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    scanPath: (targetPath) => ipcRenderer.invoke('scan-path', targetPath),
    onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_event, value) => callback(value)),
    removeScanProgressListener: () => ipcRenderer.removeAllListeners('scan-progress'),
    generatePdf: (reportData) => ipcRenderer.invoke('generate-pdf', reportData),
    openPdf: (pdfPath) => ipcRenderer.invoke('open-pdf', pdfPath),
    openPdfExternal: (buffer) => ipcRenderer.invoke('open-pdf-external', buffer),
    closeApp: () => ipcRenderer.invoke('close-app'),
});
