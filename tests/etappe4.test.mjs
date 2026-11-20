// Tests für Etappe 4: Reaktionen mit Bausteinen ausgleichen (Bereich 2).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { starten, WURZEL, PFAD } from './server.mjs';
import * as A from '../js/ausgleichen-logik.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const elemente = JSON.parse(await fs.readFile(path.join(WURZEL, 'daten/elemente.json'), 'utf8')).elemente;
const b2 = JSON.parse(await fs.readFile(path.join(WURZEL, 'daten/aufgaben/b2.json'), 'utf8'));
const reaktionen = b2.aufgaben.filter((a) => a.typ === 'ausgleichen');

// ---------- Chemie und Logik ----------

test('Alle Reaktionen: Lösung ausgeglichen, kleinste Zahlen, höchstens 40 Steine, Daten gültig', () => {
  assert.ok(reaktionen.length >= 30);
  for (const a of reaktionen) {
    assert.deepEqual(A.ausgleichenPruefen(a, elemente), [], a.id);
    const w = A.waage(a, a.loesung);
    assert.ok(w.ausgeglichen && w.kleinste, `${a.id}: ${A.gleichungText(a, a.loesung)}`);
    assert.ok(A.steineGesamt(a, a.loesung) <= A.MAX_STEINE, a.id);
    assert.ok(a.loesung.every((n) => n <= A.MAX_ZAHL), a.id);
    // Ausgleichen-Aufgaben beginnen nie schon gelöst
    if (!a.pruefen) assert.equal(A.waage(a, A.startZahlen(a)).geloest, false, a.id);
  }
  for (const n of [1, 2, 3]) assert.ok(b2.aufgaben.filter((a) => a.niveau === n).length >= 10, `★${n}`);
});

test('Reaktionen aus dem Auftrag sind dabei', () => {
  const gleichungen = reaktionen.map((a) => A.gleichungText(a, a.loesung));
  for (const g of ['CuO + Fe → Cu + FeO', '2 Mg + O2 → 2 MgO', '2 CuO + C → 2 Cu + CO2', '3 CuO + 2 Fe → 3 Cu + Fe2O3',
    '4 Al + 3 O2 → 2 Al2O3', 'Fe2O3 + 2 Al → 2 Fe + Al2O3', '2 Fe2O3 + 3 C → 4 Fe + 3 CO2', '2 Mg + CO2 → 2 MgO + C', '2 H2 + O2 → 2 H2O']) {
    assert.ok(gleichungen.includes(g), g);
  }
});

test('Waage, Hinweise und kleinste Zahlen', () => {
  const a = reaktionen.find((x) => x.id === 'b2-1-06'); // 2 Mg + O2 → 2 MgO
  let w = A.waage(a, [1, 1, 1]);
  assert.equal(w.ausgeglichen, false);
  assert.equal(w.kipp, 1, 'links mehr Atome');
  assert.match(A.ausgleichHinweis(a, [1, 1, 1]), /O-Atome: links 2, rechts 1/);
  w = A.waage(a, [4, 2, 4]);
  assert.equal(w.ausgeglichen, true);
  assert.equal(w.geloest, false, 'doppelte Zahlen sind nicht die kleinsten');
  assert.match(A.ausgleichHinweis(a, [4, 2, 4]), /kleineren Zahlen/);
  assert.equal(A.waage(a, [2, 1, 2]).geloest, true);
});

test('Index-Falle: H2O → H2O2, CuO → Cu2O, nie Ozon', () => {
  const stoff = (formel) => reaktionen.flatMap((a) => [...a.edukte, ...a.produkte]).find((s) => s.formel === formel);
  assert.equal(A.falle(stoff('H2O'), elemente).neu, 'H2O2');
  assert.match(A.falle(stoff('H2O'), elemente).text, /Wasserstoffperoxid/);
  assert.equal(A.falle(stoff('CuO'), elemente).neu, 'Cu2O');
  assert.equal(A.falle(stoff('O2'), elemente).neu, null);
  assert.match(A.falle(stoff('O2'), elemente).text, /Zweierteilchen/);
  assert.equal(A.falle(stoff('Mg'), elemente).neu, null);
  assert.match(A.falle(stoff('Mg'), elemente).text, /Verbände/);
  for (const s of reaktionen.flatMap((a) => [...a.edukte, ...a.produkte])) assert.notEqual(A.falle(s, elemente).neu, 'O3', s.formel);
});

test('Namen mit römischer Zahl bei Eisen- und Kupferverbindungen', () => {
  for (const s of reaktionen.flatMap((a) => [...a.edukte, ...a.produkte])) {
    if (/^(Fe|Cu)\d*[A-Z]/.test(s.formel)) assert.match(s.name, /\((I|II|III)\)/, s.formel);
  }
});

// ---------- Im Browser ----------

let server, browser, basis;
before(async () => {
  server = await starten(0);
  basis = `http://127.0.0.1:${server.address().port}${PFAD}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function seiteMitAufgabe(id, viewport = { width: 820, height: 1180 }) {
  const kontext = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  await seite.goto(basis);
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  const datenFehler = await seite.evaluate(async (aid) => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'BENTES', anzeige: 'Ben Test', element: 'C', gesperrt: false }]));
    const { rundeSpielen } = await import('./js/runde.js');
    const { allesLaden, alleFehler } = await import('./js/daten.js');
    const d = await allesLaden();
    const a = d.aufgaben.B2.find((x) => x.id === aid);
    window.__ende = null;
    rundeSpielen({ ziel: document.getElementById('inhalt'), daten: d, name: 'BENTES', bereich: 'B2', niveau: a.niveau, kurs: 'E',
      aufgaben: [a], art: 'normal', fertig: (e) => { window.__ende = e; } });
    return alleFehler();
  }, id);
  assert.deepEqual(datenFehler, [], 'Datendateien ohne Fehler');
  return { kontext, seite, fehler };
}
const plus = (seite, name) => seite.getByRole('button', { name: `Ein Teilchen ${name} mehr` }).click();

test('Abnahme: 2 Mg + O2 → 2 MgO mit + ausgleichen, Waage steht gerade, Gleichung erscheint', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b2-1-06');
  assert.match(await seite.locator('.waage-satz').textContent(), /kippt nach links/);
  await plus(seite, 'Magnesiumoxid');
  await plus(seite, 'Magnesium');
  await seite.locator('.bau-formel.ist-richtig').waitFor();
  assert.match(await seite.locator('.bau-formel').textContent(), /2 Mg \+ O2 → 2 MgO/);
  assert.match(await seite.locator('.waage-satz').textContent(), /steht gerade/);
  await seite.getByRole('button', { name: /Weiter/ }).click();
  await seite.waitForFunction(() => window.__ende);
  assert.equal(await seite.evaluate(() => window.__ende.punkte), 10);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Index-Falle: „Atom anhängen“ erklärt und nimmt die Änderung zurück', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b2-1-07'); // 2 H2 + O2 → 2 H2O
  await seite.getByRole('button', { name: 'Bei Wasser ein Atom anhängen' }).click();
  await seite.getByText(/Wasserstoffperoxid/).waitFor();
  assert.equal(await seite.locator('.stoff-karte.falle-aktiv').count(), 1);
  await seite.getByRole('button', { name: /Zurücknehmen/ }).click();
  assert.equal(await seite.locator('.stoff-karte.falle-aktiv').count(), 0);
  assert.equal(await seite.locator('.bau-formel.ist-richtig').count(), 0, 'nicht gelöst');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('★★★: Waage verdeckt, „Wiegen“ zählt als Versuch, danach ist die Waage sichtbar', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b2-3-01'); // Thermit
  assert.equal(await seite.locator('.waage.verdeckt').count(), 1);
  await seite.getByRole('button', { name: /Wiegen und prüfen/ }).click();
  await seite.getByRole('button', { name: 'Nochmal versuchen' }).waitFor();
  assert.equal(await seite.locator('.waage.verdeckt').count(), 0);
  await seite.getByRole('button', { name: 'Nochmal versuchen' }).click();
  await plus(seite, 'Eisen');
  await plus(seite, 'Aluminium');
  await seite.getByRole('button', { name: /Wiegen und prüfen/ }).click();
  await seite.locator('.bau-formel.ist-richtig').waitFor();
  assert.match(await seite.locator('.bau-formel').textContent(), /Fe2O3 \+ 2 Al → 2 Fe \+ Al2O3/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Prüfen-Aufgabe: „Nein“ ist richtig, danach zeigt sich die Waage', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b2-1-04'); // Mg + O2 → MgO
  assert.equal(await seite.locator('.waage.verdeckt').count(), 1);
  assert.equal(await seite.getByRole('button', { name: /Ein Teilchen/ }).count(), 0, 'keine + und – beim Prüfen');
  await seite.getByRole('button', { name: /Nein/ }).click();
  await seite.getByRole('button', { name: /Weiter/ }).waitFor();
  assert.equal(await seite.locator('.waage.verdeckt').count(), 0);
  await seite.getByRole('button', { name: /Weiter/ }).click();
  await seite.waitForFunction(() => window.__ende);
  assert.equal(await seite.evaluate(() => window.__ende.punkte), 10);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Handy-Breite: kein waagerechtes Scrollen bei der Hochofen-Aufgabe', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b2-3-02', { width: 375, height: 760 });
  const breite = await seite.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(breite <= 375, `scrollWidth ${breite}`);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('So geht’s für Bereich 2 läuft durch, Lehrer-Ansicht kennt B2', async () => {
  const kontext = await browser.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'block' });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  await seite.goto(basis);
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  const bereiche = await seite.evaluate(async () => {
    const { allesLaden } = await import('./js/daten.js');
    const { soGehtsAusgleichen } = await import('./js/so-gehts.js');
    const L = await import('./js/lehrer-daten.js');
    const d = await allesLaden();
    soGehtsAusgleichen(d.elemente);
    return L.lehrerBereiche({ runden: [] });
  });
  assert.ok(bereiche.includes('B2'));
  for (let i = 0; i < 3; i++) await seite.getByRole('button', { name: /Weiter/ }).click();
  assert.match(await seite.locator('.waage-satz').textContent(), /steht gerade/);
  await seite.getByRole('button', { name: /Los geht/ }).click();
  assert.deepEqual(fehler, []);
  await kontext.close();
});
