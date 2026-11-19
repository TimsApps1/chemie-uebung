// Tests für Etappe 1: Namen, Codes, Daten, Chemie, Runden, Sortieren.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { starten, WURZEL, PFAD } from './server.mjs';
import { nameVereinheitlichen, tagNummer, wocheVonTag, atomeZaehlen } from '../js/hilfen.js';
import { freischaltcode, freischaltcodePruefen, punktecode, punktecodeLesen, KURSE_PRO_BEREICH } from '../js/codes.js';
import { ALPHABET } from '../js/pruefsumme.js';

const { chromium } = createRequire(import.meta.url)('playwright');

// ---------- Ohne Browser ----------

test('Namen werden vereinheitlicht', () => {
  assert.equal(nameVereinheitlichen('Lena-Marie Özdemir'), 'LENAMARI');
  assert.equal(nameVereinheitlichen('Jörg'), 'JOERG');
  assert.equal(nameVereinheitlichen('  max  '), 'MAX');
  assert.equal(nameVereinheitlichen('Ümit'), 'UEMIT');
  assert.equal(nameVereinheitlichen('Strauß'), 'STRAUSS');
  assert.equal(nameVereinheitlichen('José'), 'JOSE');
});

test('Freischaltcodes: gültig, getrennt nach Kurs, ohne Verwechslungszeichen', () => {
  for (const [bereich, kurse] of Object.entries(KURSE_PRO_BEREICH)) {
    for (const kurs of kurse) {
      const code = freischaltcode(bereich, kurs, 1);
      assert.match(code, new RegExp(`^[${ALPHABET}]{6}$`));
      assert.doesNotMatch(code, /[01OIL]/);
      assert.deepEqual(freischaltcodePruefen(code), { bereich, kurs, serie: 1 });
      assert.deepEqual(freischaltcodePruefen(` ${code.toLowerCase().slice(0, 3)} ${code.toLowerCase().slice(3)} `), { bereich, kurs, serie: 1 });
    }
  }
  assert.notEqual(freischaltcode('B3', 'G', 1), freischaltcode('B3', 'E', 1));
  assert.notEqual(freischaltcode('B3', 'G', 1), freischaltcode('B3', 'G', 2));
  assert.equal(freischaltcodePruefen('AAAAAA'), null);
  assert.equal(freischaltcodePruefen(freischaltcode('B3', 'G', 1), 2), null, 'alte Serie gesperrt');
});

test('Punktecode: Aufbau mit Kurs, Erstversuchen und Rundennummer; Prüfsumme erkennt Änderungen', () => {
  const code = punktecode({ name: 'LENA', bereich: 'B3', niveau: 2, punkte: 80, tag: 127, kurs: 'E', erster: 6, nummer: 7 });
  assert.match(code, /^LENA-B3-2-0080-0127-E6-007-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$/);
  const gelesen = punktecodeLesen(code.toLowerCase().replace(/-/g, ' - '));
  assert.equal(gelesen.ok, true);
  assert.deepEqual([gelesen.punkte, gelesen.kurs, gelesen.erster, gelesen.nummer], [80, 'E', 6, 7]);
  for (const [alt, neu] of [['0080', '0090'], ['LENA', 'LENE'], ['E6', 'G6'], ['E6', 'E7'], ['-007-', '-008-']]) {
    assert.equal(punktecodeLesen(code.replace(alt, neu)).ok, false, `${alt} -> ${neu}`);
  }
  assert.equal(punktecodeLesen('LENA-B3-2-0080-0127-DQS').ok, true, 'älteres Format');
  assert.match(punktecode({ name: 'TOM', bereich: 'B4', niveau: 1, punkte: 60, tag: 10, nummer: 1000 }), /-001-/);
  assert.notEqual(punktecode({ name: 'TOM', bereich: 'B4', niveau: 1, punkte: 60, tag: 10, nummer: 1 }),
    punktecode({ name: 'TOM', bereich: 'B4', niveau: 1, punkte: 60, tag: 10, nummer: 2 }));
});

test('Kurzname aus Vor- und Nachname', async () => {
  const { kurzname } = await import('../js/hilfen.js');
  assert.equal(kurzname('Mohammed Yilmaz'), 'MOHAMYIL');
  assert.equal(kurzname('Mohammed Kaya'), 'MOHAMKAY');
  assert.equal(kurzname('Lena Özil'), 'LENAOEZ');
  assert.equal(kurzname('Tom'), 'TOM');
  assert.equal(kurzname('Ayşe Yılmaz'), 'AYSEYIL');
});

test('Vorlesen: Formeln und Symbole werden buchstabiert', async () => {
  const { vorlesbar } = await import('../js/hilfen.js');
  assert.equal(vorlesbar('Co oder CO?'), 'C klein o oder C O?');
  assert.equal(vorlesbar('2 H2O'), '2 mal H 2 O');
  assert.equal(vorlesbar('3 CO2'), '3 mal C O 2');
  assert.equal(vorlesbar('2 MgCl2'), '2 mal M klein g C klein l 2');
  assert.equal(vorlesbar('Klasse 9 Chemie'), 'Klasse 9 Chemie');
  assert.match(vorlesbar('Welches Symbol hat Natrium? Na, NA'), /N klein a, N A/);
});

test('Tag und Woche nach deutscher Zeit', () => {
  assert.equal(tagNummer(new Date('2025-08-01T10:00:00Z')), 0);
  assert.equal(tagNummer(new Date('2025-07-31T22:30:00Z')), 0, '00:30 Uhr deutscher Zeit zählt schon zum 01.08.');
  assert.equal(tagNummer(new Date('2025-08-02T10:00:00Z')), 1);
  // Mo 04.08.2025 = Tag 3, So 10.08. = Tag 9, Mo 11.08. = Tag 10
  assert.equal(wocheVonTag(3), wocheVonTag(9));
  assert.notEqual(wocheVonTag(9), wocheVonTag(10));
  assert.notEqual(wocheVonTag(2), wocheVonTag(3), 'Sonntag 03.08. gehört zur Woche davor');
});

test('Atome zählen', () => {
  assert.equal(atomeZaehlen('H2O').gesamt, 3);
  assert.equal(atomeZaehlen('CO2').gesamt, 3);
  assert.equal(atomeZaehlen('Al2O3').gesamt, 5);
  assert.equal(atomeZaehlen('2 H2O', 'H').gesamt, 4);
  assert.equal(atomeZaehlen('2 H2O').gesamt, 6);
  assert.equal(atomeZaehlen('3 CO2', 'O').gesamt, 6);
});

// ---------- Daten (mit echter Prüfung der App) ----------

async function datenLaden() {
  globalThis.fetch = async (datei) => {
    try {
      const t = await fs.readFile(path.join(WURZEL, datei), 'utf8');
      return { ok: true, text: async () => t, json: async () => JSON.parse(t) };
    } catch { return { ok: false }; }
  };
  const modul = await import('../js/daten.js');
  const d = await modul.allesLaden();
  return { d, fehler: modul.alleFehler(), modul };
}

test('Alle Datendateien sind fehlerfrei', async () => {
  const { fehler } = await datenLaden();
  assert.deepEqual(fehler, []);
});

test('Kaputtes JSON: Hinweis mit Dateiname und Zeile', async () => {
  const kaputt = '{\n  "titel": "x",\n  "zwei": "y"\n  "drei": 3\n}';
  globalThis.fetch = async () => ({ ok: true, text: async () => kaputt });
  const { jsonLaden, alleFehler } = await import('../js/daten.js');
  const vorher = alleFehler().length;
  assert.equal(await jsonLaden('daten/test.json'), null);
  const f = alleFehler().slice(vorher)[0];
  assert.equal(f.datei, 'daten/test.json');
  assert.equal(f.zeile, 4);
  assert.match(f.text, /Komma/);
});

test('Genug Aufgaben: pro Bereich und Niveau mindestens 10 (G und E)', async () => {
  const { d } = await datenLaden();
  for (const b of ['B3', 'B4']) {
    for (const n of [1, 2, 3]) {
      const g = d.aufgaben[b].filter((a) => a.niveau === n && a.kurs !== 'E').length;
      const e = d.aufgaben[b].filter((a) => a.niveau === n).length;
      assert.ok(g >= 10, `${b} ★${n}: nur ${g} Aufgaben für den G-Kurs`);
      assert.ok(e >= 10, `${b} ★${n}: nur ${e} Aufgaben für den E-Kurs`);
    }
  }
});

test('Chemie: Reihe, „Klappt es?“, Wortgleichungen, Sprachregeln', async () => {
  const { d, modul } = await datenLaden();
  assert.deepEqual(d.reihe.stoffe.map((s) => s.name),
    ['Gold', 'Silber', 'Kupfer', 'Blei', 'Eisen', 'Kohlenstoff', 'Zink', 'Aluminium', 'Magnesium']);
  // Beispiele aus dem Unterricht
  assert.equal(modul.klapptEs(d.reihe, 'Kupferoxid', 'Zink'), true);
  assert.equal(modul.klapptEs(d.reihe, 'Zinkoxid', 'Kupfer'), false);
  assert.equal(modul.klapptEs(d.reihe, 'Eisenoxid', 'Aluminium'), true);
  assert.equal(modul.klapptEs(d.reihe, 'Kupferoxid', 'Kohlenstoff'), true);
  assert.equal(modul.klapptEs(d.reihe, 'Aluminiumoxid', 'Kohlenstoff'), false);
  assert.equal(modul.klapptEs(d.reihe, 'Kohlenstoffdioxid', 'Magnesium'), true);

  const oxidVon = Object.fromEntries(d.reihe.stoffe.filter((s) => s.oxid).map((s) => [s.name, s.oxid]));
  const elementVon = Object.fromEntries(d.reihe.stoffe.filter((s) => s.oxid).map((s) => [s.oxid, s.name]));
  for (const a of d.aufgaben.B3) {
    const alleTexte = JSON.stringify(a);
    assert.doesNotMatch(alleTexte, /Elektron|Ion(en)?\b/, `${a.id}: Ionen/Elektronen kommen in Klasse 9 nicht vor`);
    assert.doesNotMatch(alleTexte, /\b(rechts|links) (in|von|steht)/i, `${a.id}: Regel nicht mit rechts/links formulieren`);
    if (a.kurs !== 'E') assert.doesNotMatch(alleTexte, /Reduktionsmittel|Oxidationsmittel/, `${a.id}: G-Aufgabe mit Reduktions-/Oxidationsmittel`);
    // Vollständige Wortgleichungen: Oxid + Element -> Element + Oxid, Sauerstoff wandert richtig
    if (a.typ === 'wortgleichung' || a.typ === 'antippen') {
      let i = 0;
      const voll = (s) => (s === '?' ? a.richtig[i++] : s);
      const links = a.links.map(voll);
      const rechts = a.rechts.map(voll);
      const oxidLinks = links.find((s) => elementVon[s]);
      const stoffLinks = links.find((s) => !elementVon[s]);
      if (oxidLinks && stoffLinks && links.length === 2) {
        assert.ok(modul.klapptEs(d.reihe, oxidLinks, stoffLinks), `${a.id}: Diese Reaktion klappt laut Reihe nicht`);
        assert.deepEqual([...rechts].sort(), [elementVon[oxidLinks], oxidVon[stoffLinks]].sort(), `${a.id}: Produkte stimmen nicht`);
      }
    }
    if (a.typ === 'antippen' && /wird reduziert|gibt Sauerstoff ab/.test(a.frage)) {
      assert.ok(elementVon[a.richtig] || a.richtig.endsWith('oxid'), `${a.id}: Reduziert wird das Oxid`);
    }
  }
  // Keine Aufgabe zählt Atome falsch (Erklärung nennt die richtige Zahl)
  for (const a of d.aufgaben.B4.filter((x) => x.typ === 'zahl')) {
    const zahl = atomeZaehlen(a.formel, a.zaehle).gesamt;
    assert.match(a.erklaerung, new RegExp(`\\b${zahl}\\b`), `${a.id}: Erklärung nennt nicht ${zahl}`);
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

async function neueSeite(viewport = { width: 820, height: 1180 }) {
  const kontext = await browser.newContext({ viewport, hasTouch: true });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  await seite.goto(basis);
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  return { kontext, seite, fehler };
}

async function codeEingeben(seite, code) {
  await seite.getByRole('button', { name: 'Code eingeben' }).first().click();
  await seite.fill('#code-feld', code);
  await seite.getByRole('button', { name: 'Freischalten' }).click();
}

test('Neuer Name, falscher Code, G-Code und E-Code', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.getByRole('button', { name: 'Neuer Name' }).click();
  await seite.fill('#name-feld', 'Lena Özil');
  await seite.locator('#name-vorschau b').getByText('LENAOEZ').waitFor();
  await seite.getByRole('button', { name: /Los geht/ }).click();
  await seite.getByRole('heading', { name: 'Hallo Lena!' }).waitFor();

  await codeEingeben(seite, 'ABCDEF');
  await seite.getByText('Das hat nicht geklappt.').waitFor();
  await seite.fill('#code-feld', 'O1ABCD');
  await seite.getByRole('button', { name: 'Freischalten' }).click();
  await seite.getByText(/kein 0, O, 1, I und L/).waitFor();

  await seite.fill('#code-feld', freischaltcode('B3', 'G', 1));
  await seite.getByRole('button', { name: 'Freischalten' }).click();
  await seite.getByText('Reaktivitätsreihe und Redox ist frei!').waitFor();
  await seite.getByRole('button', { name: /Weiter/ }).click();

  // G-Kurs: Im Browser dieselbe Rundenauswahl 300-mal ziehen – nie Reduktionsmittel
  const ergebnisG = await seite.evaluate(async () => {
    const { aufgabenWaehlen } = await import('./js/runde.js');
    const { allesLaden } = await import('./js/daten.js');
    const d = await allesLaden();
    let gefunden = 0;
    for (let i = 0; i < 300; i++) {
      for (const n of [1, 2, 3]) {
        const runde = aufgabenWaehlen(d.aufgaben.B3, n, 'G');
        if (runde.length !== 8) return 'falsche Länge ' + runde.length;
        if (runde.some((a) => /Reduktionsmittel|Oxidationsmittel/.test(JSON.stringify(a)))) gefunden++;
      }
    }
    return gefunden;
  });
  assert.equal(ergebnisG, 0);

  const ergebnisE = await seite.evaluate(async () => {
    const { aufgabenWaehlen } = await import('./js/runde.js');
    const { allesLaden } = await import('./js/daten.js');
    const d = await allesLaden();
    let gefunden = 0;
    for (let i = 0; i < 100; i++) {
      const runde = aufgabenWaehlen(d.aufgaben.B3, 2, 'E');
      if (runde.some((a) => /Reduktionsmittel|Oxidationsmittel/.test(JSON.stringify(a)))) gefunden++;
    }
    return gefunden;
  });
  assert.ok(ergebnisE > 0, 'Mit E-Code kommen Reduktions-/Oxidationsmittel vor');

  await codeEingeben(seite, freischaltcode('B3', 'E', 1));
  await seite.getByText('Mit allen Aufgaben für den E-Kurs.').waitFor();
  const kurs = await seite.evaluate(() => JSON.parse(localStorage.getItem('chemie:kind:LENAOEZ')).freigeschaltet.B3);
  assert.equal(kurs, 'E');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Sortieren geht mit Antippen und mit Ziehen', async () => {
  const { kontext, seite, fehler } = await neueSeite({ width: 820, height: 1180 });
  await seite.evaluate(async () => {
    const { aufgabeDarstellen } = await import('./js/aufgaben.js');
    const { allesLaden } = await import('./js/daten.js');
    const d = await allesLaden();
    const a = { typ: 'sortieren', karten: ['Gold', 'Kupfer', 'Eisen', 'Zink', 'Magnesium'] };
    window.__antwort = null;
    const darst = aufgabeDarstellen(a, (w) => { window.__antwort = w; }, d);
    document.getElementById('inhalt').replaceChildren(darst.wurzel);
  });
  const namen = async () => seite.locator('.sortierkarte').evaluateAll((l) => l.map((k) => k.dataset.name));
  const vorher = await namen();
  // Antippen: Karte 1 und 3 tauschen
  await seite.locator('.sortierkarte').nth(0).click();
  await seite.locator('.sortierkarte').nth(2).click();
  const getauscht = await namen();
  assert.deepEqual(getauscht, [vorher[2], vorher[1], vorher[0], vorher[3], vorher[4]]);
  // Ziehen: letzte Karte nach oben
  const k = seite.locator('.sortierkarte');
  const letzte = await k.nth(4).boundingBox();
  const erste = await k.nth(0).boundingBox();
  await seite.mouse.move(letzte.x + 40, letzte.y + letzte.height / 2);
  await seite.mouse.down();
  for (let y = letzte.y + letzte.height / 2; y > erste.y; y -= 12) await seite.mouse.move(letzte.x + 40, y);
  await seite.mouse.up();
  const gezogen = await namen();
  assert.equal(gezogen[0], getauscht[4]);
  assert.deepEqual(gezogen.slice(1), getauscht.slice(0, 4));
  await seite.getByRole('button', { name: /Fertig/ }).click();
  assert.deepEqual(await seite.evaluate(() => window.__antwort), gezogen);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Ganze Runde spielen: Punktecode am Ende ist gültig, Abbrechen zählt nicht', async () => {
  const { kontext, seite, fehler } = await neueSeite({ width: 375, height: 800 });
  await seite.evaluate((code) => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'TOM', element: 'Fe', gesperrt: false }]));
    localStorage.setItem('chemie:kind:TOM', JSON.stringify({ freigeschaltet: { B4: 'G' }, geschichteGesehen: { B4: true } }));
    return code;
  });
  await seite.reload();
  await seite.getByRole('button', { name: /TOM/ }).click();

  // Abbrechen
  await seite.locator('button.bereich.b4').click();
  await seite.locator('.niveau-knopf').first().click();
  await seite.getByRole('button', { name: 'Runde abbrechen' }).click();
  await seite.getByRole('button', { name: 'Ja, abbrechen' }).click();
  await seite.getByRole('heading', { name: 'Hallo TOM!' }).waitFor();
  assert.equal(await seite.evaluate(() => (JSON.parse(localStorage.getItem('chemie:kind:TOM')).runden || []).length), 0);

  // Runde zu Ende spielen (irgendwelche Antworten)
  await seite.locator('button.bereich.b4').click();
  await seite.locator('.niveau-knopf').first().click();
  for (let schritt = 0; schritt < 60; schritt++) {
    if (await seite.getByText('Runde geschafft!').count()) break;
    const weiter = seite.getByRole('button', { name: /Weiter/ });
    if (await weiter.count()) { await weiter.click(); continue; }
    const nochmal = seite.getByRole('button', { name: 'Nochmal versuchen' });
    if (await nochmal.count()) { await nochmal.click(); continue; }
    const antwort = seite.locator('.antwort:not([disabled]), .stoff-knopf:not([disabled])');
    if (await antwort.count()) { await antwort.first().click(); continue; }
    if (await seite.locator('.taste').count()) {
      await seite.locator('.taste').nth(2).click();
      await seite.getByRole('button', { name: 'Prüfen' }).click();
      continue;
    }
    if (await seite.locator('.chip').count()) {
      for (const c of await seite.locator('.chip').all()) await c.click();
      await seite.getByRole('button', { name: 'Prüfen' }).click();
      continue;
    }
    if (await seite.locator('.sortierkarte').count()) { await seite.getByRole('button', { name: /Fertig/ }).click(); continue; }
    await seite.waitForTimeout(100);
  }
  await seite.getByText('Runde geschafft!').waitFor();
  const code = await seite.locator('#punktecode').textContent();
  const gelesen = punktecodeLesen(code);
  assert.equal(gelesen.ok, true, code);
  assert.equal(gelesen.name, 'TOM');
  assert.equal(gelesen.bereich, 'B4');
  assert.equal(gelesen.niveau, 1);
  const gespeichert = await seite.evaluate(() => JSON.parse(localStorage.getItem('chemie:kind:TOM')).runden);
  assert.equal(gespeichert.length, 1);
  assert.equal(gespeichert[0].punkte, gelesen.punkte);
  assert.equal(await seite.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Lehrkraft: PIN, Codes sichtbar, falsche PIN abgelehnt', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  for (const z of '1234') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByText('✗ Die PIN stimmt nicht.').waitFor();
  for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByRole('heading', { name: 'Freischaltcodes' }).waitFor();
  await seite.getByText(freischaltcode('B3', 'G', 1)).waitFor();
  await seite.getByText(freischaltcode('B3', 'E', 1)).waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Kein Klartext-Code im Quelltext', async () => {
  const dateien = (await fs.readdir(path.join(WURZEL, 'js'))).map((n) => `js/${n}`).concat(['daten/app.json']);
  const codes = Object.entries(KURSE_PRO_BEREICH).flatMap(([b, k]) => k.map((kurs) => freischaltcode(b, kurs, 1)));
  for (const d of dateien) {
    const t = await fs.readFile(path.join(WURZEL, d), 'utf8');
    for (const c of codes) assert.ok(!t.includes(c), `${d} enthält den Code ${c} im Klartext`);
    assert.ok(!t.includes('4711'), `${d} enthält die PIN im Klartext`);
  }
});

test('Vorlesen nennt die Antworten in der angezeigten Reihenfolge', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const ergebnis = await seite.evaluate(async () => {
    const { aufgabeDarstellen, vorleseText } = await import('./js/aufgaben.js');
    const a = { typ: 'auswahl', frage: 'Welches Symbol hat Natrium?', antworten: ['Na', 'NA', 'N', 'So'], richtig: 'Na' };
    const versuche = [];
    for (let i = 0; i < 20; i++) {
      const d = aufgabeDarstellen(a, () => {}, {});
      document.getElementById('inhalt').replaceChildren(d.wurzel);
      const sichtbar = [...document.querySelectorAll('.antwort')].map((k) => k.dataset.wert);
      versuche.push({ sichtbar, text: vorleseText(a, d.reihenfolge) });
    }
    return versuche;
  });
  for (const v of ergebnis) {
    v.sichtbar.forEach((w, i) => assert.ok(v.text.includes(`Antwort ${i + 1}: ${w.length <= 3 ? '' : w}`)));
    const ersteNa = v.sichtbar.indexOf('Na') + 1;
    assert.ok(v.text.includes(`Antwort ${ersteNa}: N klein a`), v.text);
  }
  assert.ok(new Set(ergebnis.map((v) => v.sichtbar.join())).size > 1, 'Antworten werden gemischt');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fehler-Runde zählt richtige Antworten und meldet Erfolge', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.evaluate(() => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'MIA', element: 'O', gesperrt: false }]));
    localStorage.setItem('chemie:kind:MIA', JSON.stringify({ freigeschaltet: { B4: 'G' },
      fehler: { 'b4-1-01': { bereich: 'B4', stufe: 0, faellig: 0, inFolge: 1 } } }));
  });
  await seite.reload();
  await seite.getByRole('button', { name: /MIA/ }).click();
  await seite.getByRole('button', { name: /Heute üben/ }).click();
  // Die Aufgabe richtig lösen (Lösung aus den Daten)
  const richtig = await seite.evaluate(async () => {
    const { allesLaden } = await import('./js/daten.js');
    const d = await allesLaden();
    return d.aufgaben.B4.find((a) => a.id === 'b4-1-01').richtig;
  });
  await seite.locator(`.antwort[data-wert="${richtig}"]`).click();
  await seite.getByRole('button', { name: /Weiter/ }).click();
  await seite.getByText('Fehler-Runde geschafft!').waitFor();
  await seite.getByText('1 gleich beim ersten Versuch richtig.').waitFor();
  await seite.getByText(/Fehler sitzt jetzt sicher/).waitFor();
  assert.equal(await seite.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('chemie:kind:MIA')).fehler).length), 0);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Lehrer-Ansicht sperrt sich beim Verlassen wieder', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const pin = async () => {
    await seite.getByRole('button', { name: 'Lehrkraft' }).click();
    for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
    await seite.getByRole('button', { name: 'OK' }).click();
    await seite.getByRole('heading', { name: 'Freischaltcodes' }).waitFor();
  };
  await pin();
  await seite.getByRole('button', { name: 'Zurück' }).click();
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  await seite.getByRole('heading', { name: 'PIN eingeben' }).waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Erzeugte Aufgaben sind gültig und passen zur Reihe', async () => {
  const { d, modul } = await datenLaden();
  const erzeugt = [...d.aufgaben.B3, ...d.aufgaben.B4].filter((a) => a.generiert);
  assert.ok(erzeugt.length > 50);
  for (const a of erzeugt) {
    assert.deepEqual(modul.aufgabePruefen(a, d), [], a.id);
    if (a.typ === 'klappt') {
      const klappt = modul.klapptEs(d.reihe, a.oxid, a.stoff);
      assert.equal(/nicht wegnehmen/.test(a.erklaerung), !klappt, `${a.id}: Erklärung passt nicht`);
    }
    if (a.typ === 'zahl') assert.match(a.erklaerung, new RegExp(`sind das ${atomeZaehlen(a.formel, a.zaehle).gesamt}\\.`));
  }
});

test('„Klappt es?“: Falsch beim ersten Versuch = Lösung, 0 Punkte, kommt wieder', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.evaluate(() => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'EMIL', anzeige: 'Emil Roth', element: 'C', gesperrt: false }]));
    localStorage.setItem('chemie:kind:EMIL', JSON.stringify({ freigeschaltet: { B3: 'G' } }));
  });
  await seite.reload();
  const ergebnis = await seite.evaluate(async () => {
    const { rundeSpielen } = await import('./js/runde.js');
    const { allesLaden, klapptEs } = await import('./js/daten.js');
    const d = await allesLaden();
    const a = d.aufgaben.B3.find((x) => x.typ === 'klappt' && !x.generiert);
    const falsch = !klapptEs(d.reihe, a.oxid, a.stoff);
    return new Promise((ok) => {
      rundeSpielen({ ziel: document.getElementById('inhalt'), daten: d, name: 'EMIL', bereich: 'B3', niveau: 1, kurs: 'G',
        aufgaben: [a], art: 'normal', fertig: (e) => ok(e) });
      // Erklär's mir vor der Antwort zeigt nicht die Aufgaben-Erklärung
      document.querySelector('.knopf-leise.knopf-breit').click();
      const fensterText = document.querySelector('.fenster').textContent;
      window.__fensterOk = !fensterText.includes(a.erklaerung);
      document.querySelector('.fenster-knoepfe button').click();
      document.querySelector(`.antwort[data-wert="${falsch ? 'ja' : 'nein'}"]`).click();
      window.__nochmal = Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Nochmal versuchen')));
      window.__weiter = () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Weiter')).click();
      window.__weiter();
      // Am Ende kommt die Aufgabe noch einmal: jetzt richtig antworten
      document.querySelector(`.antwort[data-wert="${falsch ? 'nein' : 'ja'}"]`).click();
      window.__weiter();
    });
  });
  assert.equal(ergebnis.punkte, 0, 'Raten beim 2. Versuch bringt keine Punkte');
  assert.deepEqual(await seite.evaluate(() => [window.__fensterOk, window.__nochmal]), [true, false]);
  assert.equal(ergebnis.falsch.length, 1);
  assert.equal(await seite.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('chemie:kind:EMIL')).fehler).length), 1);
  assert.deepEqual(fehler, []);
  await kontext.close();
});
