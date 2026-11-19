// Tests für Etappe 0: Grundgerüst, offline, Version, Update-Hinweis.
// Aufruf: node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { starten, WURZEL, PFAD } from './server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const GROESSEN = [
  { name: 'iPad hoch', width: 820, height: 1180 },
  { name: 'iPad quer', width: 1180, height: 820 },
  { name: 'Handy', width: 375, height: 740 }
];

async function swListe() {
  const sw = await fs.readFile(path.join(WURZEL, 'sw.js'), 'utf8');
  const block = sw.match(/const APP_DATEIEN = \[([\s\S]*?)\];/)[1];
  const daten = sw.match(/const DATEN_DATEIEN = \[([\s\S]*?)\];/)[1];
  const holen = (t) => [...t.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return { sw, app: holen(block), daten: holen(daten) };
}

async function dateienIn(ordner, filter) {
  const eintraege = await fs.readdir(path.join(WURZEL, ordner));
  return eintraege.filter(filter).map((n) => `${ordner}/${n}`);
}

let server, browser, basis;
let swAenderung = null; // wird im Update-Test gesetzt

before(async () => {
  const ersetzungen = new Map([['sw.js', (t) => (swAenderung ? swAenderung(t) : t)]]);
  server = await starten(0, ersetzungen);
  basis = `http://127.0.0.1:${server.address().port}${PFAD}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('Versionsnummer in sw.js und js/version.js ist gleich', async () => {
  const { sw } = await swListe();
  const v = await fs.readFile(path.join(WURZEL, 'js/version.js'), 'utf8');
  const a = sw.match(/const VERSION = (\d+);/)[1];
  const b = v.match(/export const VERSION = (\d+);/)[1];
  assert.equal(a, b);
});

test('Alle App-Dateien stehen in der Offline-Liste und existieren', async () => {
  const { app, daten } = await swListe();
  const noetig = [
    ...(await dateienIn('js', (n) => n.endsWith('.js'))),
    ...(await dateienIn('css', (n) => n.endsWith('.css'))),
    ...(await dateienIn('lib', (n) => n.endsWith('.js'))),
    ...(await dateienIn('bilder', (n) => n.startsWith('icon-'))),
    'index.html', 'manifest.json'
  ];
  for (const d of noetig) assert.ok(app.includes(d), `${d} fehlt in sw.js (APP_DATEIEN)`);
  for (const d of [...app, ...daten].filter((d) => d !== './')) {
    await fs.access(path.join(WURZEL, d)).catch(() => assert.fail(`${d} steht in sw.js, gibt es aber nicht`));
  }
  const datenDateien = await dateienIn('daten', (n) => n.endsWith('.json'));
  for (const d of datenDateien) assert.ok(daten.includes(d), `${d} fehlt in sw.js (DATEN_DATEIEN)`);
});

test('Keine Verweise auf fremde Server im Code', async () => {
  const dateien = [
    'index.html', 'manifest.json', 'sw.js',
    ...(await dateienIn('js', (n) => n.endsWith('.js'))),
    ...(await dateienIn('css', (n) => n.endsWith('.css')))
  ];
  for (const d of dateien) {
    const t = await fs.readFile(path.join(WURZEL, d), 'utf8');
    assert.ok(!/https?:\/\//.test(t), `${d} enthält eine Internetadresse`);
  }
});

for (const g of GROESSEN) {
  test(`Start, Offline-Start und Tippflächen (${g.name} ${g.width}×${g.height})`, async () => {
    const kontext = await browser.newContext({ viewport: { width: g.width, height: g.height }, hasTouch: true });
    const fremde = [];
    kontext.on('request', (r) => { if (!r.url().startsWith(basis.split(PFAD)[0])) fremde.push(r.url()); });
    const seite = await kontext.newPage();
    const fehler = [];
    seite.on('pageerror', (e) => fehler.push(e.message));

    await seite.goto(basis);
    await seite.getByText('Version 1').waitFor();
    await seite.getByText('Offline bereit').waitFor();
    assert.equal(await seite.locator('.status-ok').filter({ hasText: 'Offline bereit' }).count(), 1);
    assert.equal(await seite.locator('#update-hinweis').isVisible(), false, 'Update-Hinweis ohne neue Version sichtbar');

    // Kein waagerechtes Scrollen
    const zuBreit = await seite.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(zuBreit, false, 'Seite ist breiter als der Bildschirm');

    // Alle Knöpfe mindestens 44 × 44
    for (const k of await seite.locator('button:visible').all()) {
      const b = await k.boundingBox();
      assert.ok(b.width >= 44 && b.height >= 44, `Knopf zu klein: ${await k.textContent()}`);
    }

    // 3D-Test
    await seite.getByRole('button', { name: '3D-Test anzeigen' }).click();
    await seite.locator('.buehne-test canvas').waitFor();

    // Flugmodus: neu laden ohne Netz
    await kontext.setOffline(true);
    await seite.reload();
    await seite.getByText('Hier entsteht deine Übungs-App').waitFor();
    await seite.getByText('Version 1').waitFor();
    await seite.getByRole('button', { name: '3D-Test anzeigen' }).click();
    await seite.locator('.buehne-test canvas').waitFor();

    assert.deepEqual(fremde, [], 'Anfragen an fremde Server');
    assert.deepEqual(fehler, [], 'JavaScript-Fehler');
    await kontext.close();
  });
}

test('Neue Version: Hinweis erscheint und lädt nach Antippen', async () => {
  const kontext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const seite = await kontext.newPage();
  await seite.goto(basis);
  await seite.getByText('Offline bereit').waitFor();
  await seite.reload(); // jetzt steuert der Offline-Speicher die Seite
  await seite.getByText('Version 1').waitFor();

  swAenderung = (t) => t.replace('const VERSION = 1;', 'const VERSION = 2;');
  try {
    await seite.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const knopf = seite.getByRole('button', { name: 'Neue Version – tippen zum Laden' });
    await knopf.waitFor();
    await Promise.all([seite.waitForEvent('load'), knopf.click()]);
    const swVersion = await seite.evaluate(() => new Promise((ok) => {
      navigator.serviceWorker.addEventListener('message', (e) => ok(e.data.swVersion), { once: true });
      navigator.serviceWorker.controller.postMessage('version?');
    }));
    assert.equal(swVersion, 2);
  } finally {
    swAenderung = null;
    await kontext.close();
  }
});
