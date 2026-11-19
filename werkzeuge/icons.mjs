// Erzeugt die App-Symbole (bilder/icon-*.png) aus einer Zeichnung.
// Aufruf: node werkzeuge/icons.mjs   (braucht Playwright, nur für Entwickler)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1f6f78"/>
  <!-- unterer Stein -->
  <rect x="96" y="290" width="320" height="130" rx="16" fill="#2b6cb0"/>
  <rect x="140" y="262" width="70" height="36" rx="10" fill="#2b6cb0"/>
  <rect x="302" y="262" width="70" height="36" rx="10" fill="#2b6cb0"/>
  <!-- oberer Stein -->
  <rect x="150" y="150" width="212" height="120" rx="16" fill="#d7263d"/>
  <rect x="180" y="118" width="62" height="40" rx="10" fill="#d7263d"/>
  <rect x="270" y="118" width="62" height="40" rx="10" fill="#d7263d"/>
  <text x="256" y="236" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="88" fill="#fff">O</text>
  <text x="256" y="388" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="88" fill="#fff">Mg</text>
</svg>`;

const browser = await chromium.launch();
for (const groesse of [180, 192, 512]) {
  const seite = await browser.newPage({ viewport: { width: groesse, height: groesse }, deviceScaleFactor: 1 });
  await seite.setContent(`<style>html,body{margin:0}svg{display:block;width:${groesse}px;height:${groesse}px}</style>${svg}`);
  await seite.screenshot({ path: path.join(wurzel, 'bilder', `icon-${groesse}.png`) });
  await seite.close();
}
await browser.close();
console.log('Symbole erzeugt.');
