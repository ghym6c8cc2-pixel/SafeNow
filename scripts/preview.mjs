import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, extname } from "node:path";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.env.SAFENOW_PREVIEW_PORT ?? 3000);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    if (pathname === "/health") {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end('{"ok":true,"app":"SafeNow"}');
      return;
    }
    let file = resolve(root, "." + pathname),
      rel = relative(root, file);
    if (rel.startsWith("..") || rel.includes(":")) {
      res.writeHead(403).end();
      return;
    }
    if (!extname(file)) file = resolve(root, "index.html");
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end(
        "Arquivo indisponível. Execute npm run export:web antes de iniciar a prévia.",
      );
  }
});
server.on("error", () => {
  console.error(
    `Não foi possível abrir a porta ${port}. Feche outra prévia ou escolha SAFENOW_PREVIEW_PORT.`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `SafeNow disponível em http://127.0.0.1:${port} · mantenha este processo aberto.`,
  ),
);
