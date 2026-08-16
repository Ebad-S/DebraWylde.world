/**
 * Serve apps/web on http://localhost:3000 only.
 * Frees a leftover listener on 3000, then binds that port exclusively.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3000;
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "web"
);

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function pidsOnPort(port) {
  const pids = new Set();
  if (process.platform === "win32") {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const needle = new RegExp(`:${port}\\s`);
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING") || !needle.test(line)) continue;
      const pid = Number(line.trim().split(/\s+/).pop());
      if (pid) pids.add(pid);
    }
    return [...pids];
  }
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    });
    return out.split(/\s+/).map(Number).filter(Boolean);
  } catch {
    return [];
  }
}

function freePort(port) {
  for (const pid of pidsOnPort(port)) {
    if (pid === process.pid) continue;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`Freed port ${port} (stopped PID ${pid})`);
    } catch {
      // Process may already have exited.
    }
  }
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const resolved = path.resolve(ROOT, `.${decoded}`);
  const root = ROOT.toLowerCase();
  if (!resolved.toLowerCase().startsWith(root)) return null;
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, "index.html");
  }
  if (!path.extname(resolved) && fs.existsSync(`${resolved}.html`)) {
    return `${resolved}.html`;
  }
  return resolved;
}

function serve(req, res) {
  const filePath = safeFile(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

freePort(PORT);
await new Promise((resolve) => setTimeout(resolve, 400));

const server = http.createServer(serve);
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is still in use. Stop the other process, then run npm run dev again.`
    );
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`Accepting connections at http://localhost:${PORT}`);
});
