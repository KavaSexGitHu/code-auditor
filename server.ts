import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Local Database
const db = new Database("history.db");

// Migration: Ensure table and columns exist
db.exec(`
  CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(audits)").all() as any[];
const columns = tableInfo.map(c => c.name);

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Get Audit History
  app.get("/api/history", (req, res) => {
    const history = db.prepare("SELECT * FROM audits ORDER BY created_at DESC LIMIT 10").all();
    res.json(history);
  });

  // API: Save Audit Result
  app.post("/api/audit/save", (req, res) => {
    const { repo_urls, verdict, similarity_score, summary, findings } = req.body;
    const stmt = db.prepare("INSERT INTO audits (repo_urls, verdict, similarity_score, summary, findings) VALUES (?, ?, ?, ?, ?)");
    stmt.run(JSON.stringify(repo_urls), verdict, similarity_score, summary, JSON.stringify(findings));
    res.json({ success: true });
  });

  // API: Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const { apiKey, model } = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    if (apiKey) upsert.run("apiKey", apiKey);
    if (model) upsert.run("model", model);
    res.json({ success: true });
  });

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", engine: "Node-Audit-Bridge" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.send) {
      process.send('server-ready');
    }
  });
}

startServer();
