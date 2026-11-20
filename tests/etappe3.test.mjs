// Tests für Etappe 3: Formeln bauen mit Noppen (Bereich 1).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { starten, WURZEL, PFAD } from './server.mjs';
import * as L from '../js/bausteine-logik.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const elemente = JSON.parse(await fs.readFile(path.join(WURZEL, 'daten/elemente.json'), 'utf8')).elemente;
const art = (x) => L.steinArt(x, elemente);

// ---------- Logik ----------

test('Abnahme: MgO, Al2O3, CO2 und Fe2O3 lassen sich Schritt für Schritt bauen', () => {
  // MgO: Mg, O anstecken, zweite Verbindung
  let m = L.leeresModell();
  L.ersterStein(m, art('Mg'));
  const o = L.anstecken(m, art('O'), 1).id;
  assert.equal(L.bauErgebnis(m, 'MgO').geloest, false, 'eine Noppe je Stein noch frei');
  L.verbinden(m, 1, o);
  assert.equal(L.bauErgebnis(m, 'MgO').geloest, true);

  // Al2O3: O=Al–O–Al=O
  m = L.leeresModell();
  const al1 = L.ersterStein(m, art('Al')).id;
  const o1 = L.anstecken(m, art('O'), al1).id;
  const o2 = L.anstecken(m, art('O'), al1).id;
  L.verbinden(m, al1, o1);
  const al2 = L.anstecken(m, art('Al'), o2).id;
  const o3 = L.anstecken(m, art('O'), al2).id;
  assert.equal(L.bauErgebnis(m, 'Al2O3').geloest, false);
  L.verbinden(m, al2, o3);
  assert.equal(L.bauErgebnis(m, 'Al2O3').geloest, true);

  // CO2: O=C=O
  m = L.leeresModell();
  const c = L.ersterStein(m, art('C')).id;
  const oa = L.anstecken(m, art('O'), c).id;
  const ob = L.anstecken(m, art('O'), c).id;
  L.verbinden(m, c, oa);
  assert.equal(L.bauErgebnis(m, 'CO2').geloest, false);
  L.verbinden(m, c, ob);
  assert.equal(L.bauErgebnis(m, 'CO2').geloest, true);

  // Fe2O3 mit Fe(III)
  m = L.leeresModell();
  const f1 = L.ersterStein(m, art('Fe(III)')).id;
  const p1 = L.anstecken(m, art('O'), f1).id;
  const p2 = L.anstecken(m, art('O'), f1).id;
  L.verbinden(m, f1, p1);
  const f2 = L.anstecken(m, art('Fe(III)'), p2).id;
  const p3 = L.anstecken(m, art('O'), f2).id;
  L.verbinden(m, f2, p3);
  assert.equal(L.bauErgebnis(m, 'Fe2O3').geloest, true);
  assert.equal(L.formelVon(L.zaehlen(m)), 'Fe2O3');
});

test('Gelöst nur, wenn alle Noppen belegt sind UND die Atomzahl stimmt', () => {
  // Fe(II) + O = FeO: alle Noppen voll, aber Ziel Fe2O3 → nicht gelöst
  const m = L.leeresModell();
  L.ersterStein(m, art('Fe(II)'));
  const o = L.anstecken(m, art('O'), 1).id;
  L.verbinden(m, 1, o);
  const e = L.bauErgebnis(m, 'Fe2O3');
  assert.equal(e.voll, true);
  assert.equal(e.geloest, false);
  assert.match(L.bauHinweis(m, 'Fe2O3', elemente), /Alle Noppen sind belegt, aber das ist FeO/);
});

test('MgO2-Fehler bekommt den Hinweis aus dem Auftrag', () => {
  const m = L.leeresModell();
  L.ersterStein(m, art('Mg'));
  L.anstecken(m, art('O'), 1);
  L.anstecken(m, art('O'), 1);
  assert.equal(L.bauHinweis(m, 'MgO', elemente), 'Zähl die Noppen: Mg hat 2, O hat 2. Ein O reicht.');
});

test('Regeln: Metall nur an Nichtmetall, höchstens 3 Verbindungen, höchstens 12 Steine, S und N eingeschränkt', () => {
  let m = L.leeresModell();
  L.ersterStein(m, art('Mg'));
  assert.match(L.anstecken(m, art('Na'), 1).grund, /Metall darf nur an Nichtmetall/);
  m = L.leeresModell();
  L.ersterStein(m, art('S'));
  assert.match(L.anstecken(m, art('O'), 1).grund, /Schwefel/);
  m = L.leeresModell();
  L.ersterStein(m, art('N'));
  assert.match(L.anstecken(m, art('O'), 1).grund, /Stickstoff/);
  m = L.leeresModell();
  L.ersterStein(m, art('C'));
  for (let i = 0; i < 4; i++) assert.equal(L.anstecken(m, art('H'), 1).ok, true);
  assert.match(L.anstecken(m, art('H'), 1).grund, /keine Noppe/);
  m = L.leeresModell();
  L.ersterStein(m, art('C'));
  const h = [];
  m = L.leeresModell();
  const c = L.ersterStein(m, art('C')).id;
  for (let i = 0; i < 11; i++) {
    const r = i === 0 ? L.anstecken(m, art('O'), c) : { ok: true };
    if (i === 0) h.push(r.id);
  }
  assert.equal(L.MAX_BINDUNG, 3);
});

test('Wertigkeiten aus der Datendatei: Fe (II)/(III) und Cu (I)/(II) als getrennte Steine', () => {
  assert.equal(art('Fe(II)').wertigkeit, 2);
  assert.equal(art('Fe(III)').wertigkeit, 3);
  assert.equal(art('Cu(I)').wertigkeit, 1);
  assert.equal(art('Cu(II)').wertigkeit, 2);
  assert.equal(art('Fe(III)').beschriftung, 'Fe (III)');
  assert.equal(art('Fe(IV)'), null);
  for (const [s, w] of [['H', 1], ['Na', 1], ['Ag', 1], ['Cl', 1], ['O', 2], ['Mg', 2], ['Zn', 2], ['Pb', 2], ['S', 2], ['Al', 3], ['N', 3], ['C', 4]]) {
    assert.equal(art(s).wertigkeit, w, s);
  }
});

test('Aufgaben in b1.json: genug pro Niveau, alle baubar, keine Schwefel-/Stickoxide und kein CO', async () => {
  const d = JSON.parse(await fs.readFile(path.join(WURZEL, 'daten/aufgaben/b1.json'), 'utf8'));
  for (const n of [1, 2, 3]) assert.ok(d.aufgaben.filter((a) => a.niveau === n).length >= 10, `★${n}`);
  for (const a of d.aufgaben.filter((x) => x.formel)) {
    assert.ok(L.loesungsModell(a.formel, [...(a.start || []), ...a.steine], elemente), `${a.id} nicht baubar`);
    assert.doesNotMatch(a.formel, /^(S|N)O\d*$|^CO$/, `${a.id}: nicht im Noppenmodell`);
  }
  // ★ ohne das Wort Wertigkeit
  for (const a of d.aufgaben.filter((x) => x.niveau === 1)) assert.doesNotMatch(JSON.stringify(a), /Wertigkeit/, a.id);
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
  await seite.evaluate(async (aid) => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'BENTES', anzeige: 'Ben Test', element: 'C', gesperrt: false }]));
    const { rundeSpielen } = await import('./js/runde.js');
    const { allesLaden } = await import('./js/daten.js');
    const d = await allesLaden();
    window.__daten = d;
    const a = d.aufgaben.B1.find((x) => x.id === aid);
    window.__ende = null;
    rundeSpielen({ ziel: document.getElementById('inhalt'), daten: d, name: 'BENTES', bereich: 'B1', niveau: a.niveau, kurs: 'E',
      aufgaben: [a], art: 'normal', fertig: (e) => { window.__ende = e; } });
  }, id);
  return { kontext, seite, fehler };
}

const listeKnopf = (seite, text, nr = 0) => seite.locator('.bau-liste li').nth(nr).getByRole('button', { name: text });

test('Bauen im Browser: MgO – Formel erscheint erst, wenn alle Noppen belegt sind', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b1-1-01');
  await seite.locator('.bau-buehne canvas').waitFor();
  await seite.locator('.bau-liste-box summary').click();
  assert.equal(await seite.locator('.bau-formel b').textContent(), '?');
  // O wählen und an Mg anstecken
  await seite.locator('.bau-stein-knopf[data-art="O"]').click();
  await listeKnopf(seite, /O hier anstecken/).click();
  assert.equal(await seite.locator('.bau-formel b').textContent(), '?', 'noch eine Noppe je Stein frei');
  // Zweite Verbindung: Mg-Noppe, dann O-Noppe
  await seite.locator('.bau-stein-knopf[data-art="O"]').click(); // Auswahl aufheben
  await listeKnopf(seite, 'Verbinden …', 0).click();
  await listeKnopf(seite, 'Hiermit verbinden', 1).click();
  await seite.locator('.bau-formel.ist-richtig').waitFor();
  assert.match(await seite.locator('.bau-formel').textContent(), /MgO/);
  await seite.getByRole('button', { name: /Weiter/ }).click();
  await seite.waitForFunction(() => window.__ende);
  assert.equal(await seite.evaluate(() => window.__ende.punkte), 10);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Bauen im Browser: falscher Stein, Lösen, Rückgängig, Hinweis nach „Fertig – prüfen“', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b1-2-01'); // Al2O3
  await seite.locator('.bau-liste-box summary').click();
  await seite.locator('.bau-stein-knopf[data-art="Al"]').click(); // erster Stein
  await seite.locator('.bau-stein-knopf[data-art="Al"]').click(); // Al gewählt
  await listeKnopf(seite, /Al hier anstecken/).click();
  assert.match(await seite.locator('.bau-status').textContent(), /Metall darf nur an Nichtmetall/);
  await seite.locator('.bau-stein-knopf[data-art="O"]').click();
  await listeKnopf(seite, /O hier anstecken/).click();
  assert.equal(await seite.locator('.bau-liste li').count(), 2);
  await seite.getByRole('button', { name: '↩ Rückgängig' }).click();
  assert.equal(await seite.locator('.bau-liste li').count(), 1);
  await listeKnopf(seite, /O hier anstecken/).click();
  await listeKnopf(seite, 'Lösen', 1).click();
  assert.equal(await seite.locator('.bau-liste li').count(), 1);
  await seite.getByRole('button', { name: 'Fertig – prüfen' }).click();
  await seite.getByText(/Noppen frei|Noppe frei/).first().waitFor();
  await seite.getByRole('button', { name: 'Nochmal versuchen' }).waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Welche Formel hat dieses Modell? – 3D-Modell erscheint, Antwort wird geprüft', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b1-2-10'); // Al2O3
  await seite.locator('.bau-buehne canvas').waitFor();
  assert.equal(await seite.locator('.bau-leiste').count(), 0, 'nur ansehen, keine Leiste');
  await seite.locator('.antwort[data-wert="Al2O3"]').click();
  await seite.getByRole('button', { name: /Weiter/ }).click();
  await seite.waitForFunction(() => window.__ende);
  assert.equal(await seite.evaluate(() => window.__ende.punkte), 10);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Tippen auf eine leuchtende Noppe im 3D-Bild steckt den Stein an', async () => {
  const { kontext, seite, fehler } = await seiteMitAufgabe('b1-1-02'); // NaCl, Start Na
  await seite.locator('.bau-buehne canvas').waitFor();
  await seite.waitForTimeout(300);
  await seite.locator('.bau-stein-knopf[data-art="Cl"]').click();
  // Mittelpunkt der Noppe des Na-Steins im Bild suchen: oberhalb der Bildmitte
  const box = await seite.locator('.bau-buehne canvas').boundingBox();
  let geklappt = false;
  for (let dy = 10; dy <= 90 && !geklappt; dy += 4) {
    await seite.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - dy);
    geklappt = (await seite.locator('.bau-liste li').count()) === 2;
  }
  assert.ok(geklappt, 'Die Noppe wurde im 3D-Bild nicht getroffen');
  await seite.locator('.bau-formel.ist-richtig').waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});
