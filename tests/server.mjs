// Kleiner Testserver: liefert den Ordner unter /chemie-uebung/ aus (wie GitHub Pages).
// Aufruf: node tests/server.mjs [port]
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PFAD = '/chemie-uebung/';

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};

// ersetzungen: Map von Dateipfad (z. B. 'sw.js') auf Funktion(text) => text – für Update-Tests.
export function starten(port = 0, ersetzungen = new Map()) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(PFAD)) { res.writeHead(404); return res.end(); }
    let rel = decodeURIComponent(url.pathname.slice(PFAD.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const datei = path.join(WURZEL, rel);
    if (!datei.startsWith(WURZEL)) { res.writeHead(403); return res.end(); }
    try {
      let inhalt = await fs.readFile(datei);
      if (ersetzungen.has(rel)) inhalt = Buffer.from(ersetzungen.get(rel)(inhalt.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(inhalt);
    } catch {
      res.writeHead(404); res.end('nicht gefunden');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await starten(Number(process.argv[2] || 8080));
  console.log(`http://127.0.0.1:${s.address().port}${PFAD}`);
}
