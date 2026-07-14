import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const port = Number(args.get("--port") || 5173);
const root = resolve(args.get("--root") || "frontend/dist");
const apiTarget = new URL(args.get("--api") || "http://localhost:8080");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function proxyApi(req, res) {
  const target = new URL(req.url || "/", apiTarget);
  const proxyReq = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...req.headers,
        host: target.host
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    send(res, 502, `Unable to proxy API request: ${error.message}`);
  });
  req.pipe(proxyReq);
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const candidate = normalize(join(root, cleanPath));
  if (!candidate.startsWith(root)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return join(root, "index.html");
}

const server = createServer(async (req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  const filePath = resolveStaticPath(req.url || "/");
  if (!filePath || !existsSync(filePath)) {
    send(res, 404, "Not found");
    return;
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";
  if (req.method === "HEAD") {
    res.writeHead(200, { "content-type": contentType });
    res.end();
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, "Method not allowed");
    return;
  }

  if (ext === ".html") {
    const html = await readFile(filePath, "utf8");
    send(res, 200, html, contentType);
    return;
  }

  res.writeHead(200, { "content-type": contentType });
  createReadStream(filePath).pipe(res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend is serving ${root}`);
  console.log(`Local: http://localhost:${port}`);
  console.log(`API proxy: /api -> ${apiTarget.href}`);
});
