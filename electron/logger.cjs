// =============================================
// RosaeFinity — Structured Logger (Phase 2)
// Rotating log files, level filtering, memory tracking
// =============================================

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LEVELS = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 };
const LEVEL_LABELS = { 0: "DEBUG", 1: "INFO ", 2: "WARN ", 3: "ERROR" };
const LEVEL_COLORS = { 0: "\x1b[90m", 1: "\x1b[32m", 2: "\x1b[33m", 3: "\x1b[31m" };
const RESET = "\x1b[0m";

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(app.getPath("userData"), "logs");
    this.maxFiles = options.maxFiles || 14;
    this.maxSizeMB = options.maxSizeMB || 50;
    this.level = options.level ?? (process.env.NODE_ENV === "production"
      ? LEVELS.INFO : LEVELS.DEBUG);

    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (_) {}

    this.info("Logger initialized", {
      level: LEVEL_LABELS[this.level],
      logDir: this.logDir,
      pid: process.pid,
      platform: process.platform,
      electron: process.versions.electron,
      node: process.versions.node,
    });
  }

  _write(level, message, data) {
    if (level < this.level) return;

    const entry = {
      ts: new Date().toISOString(),
      lvl: LEVEL_LABELS[level],
      msg: message,
      pid: process.pid,
      mem: this._memMB(),
      ...(data && Object.keys(data).length > 0 && { data }),
    };

    // Console output with color
    const line = `${LEVEL_COLORS[level]}[${entry.lvl}] ${entry.ts} ${message}${RESET}`;
    if (data && Object.keys(data).length > 0) {
      console.log(line, data);
    } else {
      console.log(line);
    }

    // File output
    try {
      const today = new Date().toISOString().split("T")[0];
      const filepath = path.join(this.logDir, `rosaefinity-${today}.log`);
      fs.appendFileSync(filepath, JSON.stringify(entry) + "\n");

      // Check size
      try {
        const stat = fs.statSync(filepath);
        if (stat.size > this.maxSizeMB * 1024 * 1024) {
          const rotated = filepath.replace(".log", `-${Date.now()}.log`);
          fs.renameSync(filepath, rotated);
        }
      } catch (_) {}
    } catch (_) {}
  }

  _memMB() {
    try {
      return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + "MB";
    } catch (_) {
      return "unknown";
    }
  }

  debug(msg, data) { this._write(LEVELS.DEBUG, msg, data); }
  info(msg, data) { this._write(LEVELS.INFO, msg, data); }
  warning(msg, data) { this._write(LEVELS.WARNING, msg, data); }
  error(msg, data) { this._write(LEVELS.ERROR, msg, data); }

  // Export all logs as string
  exportLogs(since) {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith("rosaefinity-") && f.endsWith(".log"))
        .sort();
      let content = "";
      for (const file of files) {
        const filepath = path.join(this.logDir, file);
        if (since) {
          const stat = fs.statSync(filepath);
          if (stat.mtime < new Date(since)) continue;
        }
        content += `\n=== ${file} ===\n`;
        content += fs.readFileSync(filepath, "utf-8");
      }
      return content;
    } catch (_) {
      return "";
    }
  }

  // List log files
  getLogFiles() {
    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.startsWith("rosaefinity-") && f.endsWith(".log"))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          size: fs.statSync(path.join(this.logDir, f)).size,
          modified: fs.statSync(path.join(this.logDir, f)).mtime,
        }))
        .sort((a, b) => b.modified - a.modified);
    } catch (_) {
      return [];
    }
  }

  // Cleanup old log files
  rotateLogs() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.maxFiles);
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith("rosaefinity-") && f.endsWith(".log"));
      for (const file of files) {
        const filepath = path.join(this.logDir, file);
        const stat = fs.statSync(filepath);
        if (stat.mtime < cutoff) {
          fs.unlinkSync(filepath);
        }
      }
    } catch (_) {}
  }

  // Get stats for diagnostics
  getStats() {
    return {
      logDir: this.logDir,
      level: LEVEL_LABELS[this.level],
      fileCount: this.getLogFiles().length,
    };
  }
}

module.exports = { Logger };
