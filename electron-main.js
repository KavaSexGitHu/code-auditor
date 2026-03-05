import { app, BrowserWindow, screen, nativeImage, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { fork, execSync } from 'child_process';
import express from 'express';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let server;
const dbPath = path.join(app.getPath('userData'), 'history.db');
const db = new Database(dbPath);

// Migration: Ensure table and columns exist
db.exec(`
  CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const tableInfo = db.prepare("PRAGMA table_info(audits)").all();
const columns = tableInfo.map((c) => c.name);
const requiredColumns = [
  { name: 'repo_urls', type: 'TEXT' },
  { name: 'verdict', type: 'TEXT' },
  { name: 'similarity_score', type: 'INTEGER' },
  { name: 'summary', type: 'TEXT' },
  { name: 'findings', type: 'TEXT' }
];

requiredColumns.forEach(col => {
  if (!columns.includes(col.name)) {
    db.exec(`ALTER TABLE audits ADD COLUMN ${col.name} ${col.type}`);
  }
});

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Setup Express Server directly in Main Process
const serverApp = express();
serverApp.use(express.json());

serverApp.get("/api/history", (req, res) => {
  const history = db.prepare("SELECT * FROM audits ORDER BY created_at DESC LIMIT 10").all();
  res.json(history);
});

serverApp.post("/api/audit/save", (req, res) => {
  const { repo_urls, verdict, similarity_score, summary, findings } = req.body;
  const stmt = db.prepare("INSERT INTO audits (repo_urls, verdict, similarity_score, summary, findings) VALUES (?, ?, ?, ?, ?)");
  stmt.run(JSON.stringify(repo_urls), verdict, similarity_score, summary, JSON.stringify(findings));
  res.json({ success: true });
});

serverApp.get("/api/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM settings").all();
  const settingsObj = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(settingsObj);
});

serverApp.post("/api/settings", (req, res) => {
  const { apiKey, model } = req.body;
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  if (apiKey) upsert.run("apiKey", apiKey);
  if (model) upsert.run("model", model);
  res.json({ success: true });
});

serverApp.get("/api/health", (req, res) => {
  res.json({ status: "ok", engine: "Main-Process-Bridge" });
});

// Serve frontend dist in production
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  serverApp.use(express.static(distPath));
  serverApp.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Force brand name as early as possible
app.setName("Code Auditor");
if (process.platform === 'win32') {
  app.setAppUserModelId('com.yassier27.Code');
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 600;
  const windowHeight = 400;
  const iconPath = path.join(__dirname, 'assets', 'icon-256x256.ico');

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 20,
    y: screenHeight - windowHeight - 20,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: "Code Auditor",
    backgroundColor: '#00000000',
    transparent: true,
    icon: iconPath,
  });

  if (process.platform === 'win32') {
    const overlayImg = nativeImage.createFromPath(iconPath);
    mainWindow.setOverlayIcon(overlayImg, 'Code Auditor Ready');
  }

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setSkipTaskbar(false);
  });

  if (process.env.NODE_ENV?.trim() === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  server = serverApp.listen(3000, "127.0.0.1", () => {
    console.log("Internal server active on port 3000");
    createWindow();
  });
}

app.whenReady().then(() => {
  if (process.env.NODE_ENV?.trim() === 'development') {
    createWindow();
  } else {
    startServer();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) server.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

async function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return "";
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'venv', '__pycache__', 'target'];
        if (!skipDirs.includes(file)) {
          await scanDirectory(filePath, fileList);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        const allowedExts = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.php', '.rb'];
        if (allowedExts.includes(ext)) {
          const content = fs.readFileSync(filePath, 'utf8');
          fileList.push(`--- FILE: ${path.relative(dir, filePath)} ---\n${content.substring(0, 2000)}`);
        }
      }
    } catch (e) {
      console.error("Scan error for:", filePath, e.message);
    }
    if (fileList.length > 50) break;
  }
  return fileList.join('\n\n');
}

ipcMain.handle('open-pdf-external', async (event, buffer) => {
  const tempPath = path.join(app.getPath('temp'), `code-auditor-report-${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, Buffer.from(buffer));
  await shell.openPath(tempPath);
  return { success: true };
});

ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('scan-path', async (event, targetPath) => {
  console.log("[SCAN] Target:", targetPath);
  try {
    if (targetPath.toLowerCase().startsWith('http')) {
      const tempDir = path.join(app.getPath('temp'), `ca-repo-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      execSync(`git clone --depth 1 ${targetPath} .`, {
        cwd: tempDir,
        stdio: 'inherit',
        timeout: 30000
      });
      const result = await scanDirectory(tempDir);
      return result || "Repository cloned but no matching source files found.";
    } else {
      const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(targetPath);
      if (fs.existsSync(absolutePath)) {
        return await scanDirectory(absolutePath);
      } else {
        return `Error: Local path '${targetPath}' does not exist.`;
      }
    }
  } catch (error) {
    console.error("[SCAN ERROR]", error);
    return `Scan Failure: ${error.message}`;
  }
});
