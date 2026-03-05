const { app, BrowserWindow, Tray, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let window = null;

app.setName("Code Auditor");
if (process.platform === 'win32') {
  app.setAppUserModelId('com.yassier27.Code');
}

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow() {
  window = new BrowserWindow({
    width: 360,
    height: 300,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'png128.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (isDev) {
    window.loadURL('http://localhost:5173');
    // window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  window.once('ready-to-show', () => {
    window.show();
    window.setSkipTaskbar(false);
  });

  // Hide window when it loses focus
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) {
      window.hide();
    }
  });
}

function createTray() {
  const { nativeImage, Menu } = require('electron');

  const iconPath = path.join(__dirname, 'assets', 'icon-256x256.ico');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Code Auditor Pro Scanner');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show App', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Quit', click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]));

  tray.on('click', () => toggleWindow());
}

const getWindowPosition = () => {
  const windowBounds = window.getBounds();
  const trayBounds = tray.getBounds();

  // Calculate position: center window horizontally below/above the tray icon
  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));

  // Position vertically above the taskbar/tray
  let y = Math.round(trayBounds.y - windowBounds.height - 10);

  // Fallback if taskbar is at the top
  if (y < 0) {
    y = Math.round(trayBounds.y + trayBounds.height + 10);
  }

  return { x, y };
}

const showWindow = () => {
  const position = getWindowPosition();
  window.setPosition(position.x, position.y, false);
  window.show();
  window.focus();
}

const toggleWindow = () => {
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.yassier27.Code');
  }

  // Hide icon from dock for macOS, as it's a tray app
  if (app.dock) {
    app.dock.hide();
  }

  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Mock Scanner Process specific to professional mode
ipcMain.handle('scan-path', async (event, targetPath) => {
  return new Promise((resolve, reject) => {
    // Simulate a complex background scan (like the Python Pro Mode)
    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;
      // Send progress to renderer
      event.sender.send('scan-progress', progress);

      if (progress >= 100) {
        clearInterval(interval);

        // Return a mock scan report
        const report = {
          target: targetPath,
          filesScanned: Math.floor(Math.random() * 5000) + 1000,
          vulnerabilities: Math.floor(Math.random() * 10),
          scanTimeMs: 4500,
          status: "SUCCESS"
        };
        resolve(report);
      }
    }, 300);
  });
});

// PDF Generator Handler
ipcMain.handle('generate-pdf', async (event, reportData) => {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Create a temporary file
    const outputPdfPath = path.join(app.getPath('temp'), `scan-report-${Date.now()}.pdf`);
    const stream = fs.createWriteStream(outputPdfPath);
    doc.pipe(stream);

    // Add content to PDF (Professional style, no emojis)
    doc.fontSize(24).font('Helvetica-Bold').text('LOCAL SCANNER PRO - SECURITY REPORT', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text('EXECUTIVE SUMMARY');
    doc.fontSize(12).font('Helvetica').text('This report contains the results of the local static analysis.');
    doc.moveDown();

    doc.rect(50, doc.y, 500, 150).stroke();
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text(`TARGET PATH: `, 60, doc.y, { continued: true }).font('Helvetica').text(reportData.target);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`FILES SCANNED: `, 60, doc.y, { continued: true }).font('Helvetica').text(reportData.filesScanned.toString());
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`VULNERABILITIES DETECTED: `, 60, doc.y, { continued: true }).font('Helvetica').text(reportData.vulnerabilities.toString());
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`STATUS: `, 60, doc.y, { continued: true }).font('Helvetica').text(reportData.status);

    doc.moveDown(5);

    // Details section
    doc.font('Helvetica-Bold').text('DETAILED FINDINGS', 50, doc.y);
    doc.font('Helvetica').fontSize(10);

    if (reportData.vulnerabilities === 0) {
      doc.text('No critical vulnerabilities detected within the local codebase. The project complies with the required security policies.');
    } else {
      doc.text(`Identified ${reportData.vulnerabilities} potential security risks. Please consult the local engine logs for detailed rule violations.`);
    }

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => {
        resolve(outputPdfPath);
      });
    });
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
});

// Open PDF Handler
ipcMain.handle('open-pdf', async (event, pdfPath) => {
  // Opens the PDF using the system's default viewer (browser, Acrobat, etc.)
  await shell.openExternal('file://' + pdfPath);
  return true;
});
