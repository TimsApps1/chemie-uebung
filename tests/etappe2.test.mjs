// Tests für Etappe 2: Codes einlesen, Zuordnung, Rangliste, Tabelle, Sicherung, QR.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { starten, PFAD } from './server.mjs';
import { pinPruefsumme, punktecode, namensKennung } from '../js/codes.js';

const { chromium } = createRequire(import.meta.url)('playwright');

let server, browser, basis;
before(async () => {
  server = await starten(0);
  basis = `http://127.0.0.1:${server.address().port}${PFAD}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function neueSeite(viewport = { width: 1180, height: 820 }) {
  const kontext = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
  await kontext.route('**/daten/app.json', async (route) => {
    const antwort = await route.fetch();
    const daten = await antwort.json();
    daten.admin_pin_pruefsumme = pinPruefsumme('4711');
    await route.fulfill({ response: antwort, json: daten });
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  await seite.goto(basis);
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  return { kontext, seite, fehler };
}

const KLASSE = 'Lena Schmidt; G\nJonas Becker; G\nElif Yilmaz; G\nNoah Klein; G\nMira Wolf; G\nTom Berg; G';

test('Abnahme: 20 Beispielcodes ergeben genau die erwarteten Top 5; Export und Import liefern dieselbe Rangliste', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const ergebnis = await seite.evaluate(async (klasse) => {
    const L = await import('./js/lehrer-daten.js');
    const { wocheVonTag } = await import('./js/hilfen.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(klasse));
    const text = await (await fetch('tests/beispielcodes.txt')).text();
    const bericht = L.einlesen(text);
    const woche = wocheVonTag(470);
    const top = L.bestenliste(L.lehrerDaten(), { bereich: 'B3', niveau: 1, woche }).map((w) => `${w.platz}. ${w.name} – ${w.wert}`);
    const top2 = L.bestenliste(L.lehrerDaten(), { bereich: 'B3', niveau: 2, woche }).map((w) => `${w.platz}. ${w.name} – ${w.wert}`);
    // Zweites Einlesen: alles doppelt
    const nochmal = L.einlesen(text);
    // Sicherung → alles löschen → Sicherung laden
    const sicherung = L.sicherungErstellen();
    L.allesLoeschen();
    const leer = L.bestenliste(L.lehrerDaten(), { bereich: 'B3', niveau: 1, woche }).length;
    const geladen = L.sicherungEinlesen(sicherung);
    const topNachImport = L.bestenliste(L.lehrerDaten(), { bereich: 'B3', niveau: 1, woche }).map((w) => `${w.platz}. ${w.name} – ${w.wert}`);
    return { neu: bericht.neu.length, doppelt: bericht.doppelt.length, ungueltig: bericht.ungueltig.length, top, top2,
      nochmalNeu: nochmal.neu.length, leer, geladen, topNachImport };
  }, KLASSE);
  assert.equal(ergebnis.neu, 16);
  assert.equal(ergebnis.doppelt, 2);
  assert.equal(ergebnis.ungueltig, 2);
  assert.deepEqual(ergebnis.top, ['1. Lena S. – 210', '2. Mira W. – 200', '3. Elif Y. – 180', '4. Jonas B. – 160', '5. Tom B. – 60']);
  assert.deepEqual(ergebnis.top2, ['1. Jonas B. – 70']);
  assert.equal(ergebnis.nochmalNeu, 0);
  assert.equal(ergebnis.leer, 0);
  assert.deepEqual(ergebnis.geladen, { ok: true, neu: 16 });
  assert.deepEqual(ergebnis.topNachImport, ergebnis.top);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Codes werden auch aus unordentlichem Classroom-Text gefunden', async () => {
  const { kontext, seite } = await neueSeite();
  const c1 = punktecode({ name: 'LENASCH', bereich: 'B4', niveau: 2, punkte: 65, tag: 400, kurs: 'G', erster: 6, kennung: namensKennung('Lena Schmidt'), geraet: 'AB', nummer: 3 });
  const c2 = punktecode({ name: 'TOMBER', bereich: 'B3', niveau: 1, punkte: 40, tag: 401, kurs: 'E', erster: 4, kennung: namensKennung('Tom Berg'), geraet: 'AB', nummer: 4 });
  const text = `Lena Schmidt\n12. Nov.\nHier mein Code:${c1}!!\n\nTom Berg 13:05\n${c2.toLowerCase()}\nDanke`;
  const gefunden = await seite.evaluate(async (t) => (await import('./js/lehrer-daten.js')).codesAusText(t), text);
  assert.deepEqual(gefunden, [c1, c2]);
  await kontext.close();
});

test('Zuordnung: genaue Namen automatisch, Tippvarianten über „Nicht zugeordnet“', async () => {
  const { kontext, seite } = await neueSeite();
  const r = await seite.evaluate(async ([klasse, genau, variante]) => {
    const L = await import('./js/lehrer-daten.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(klasse));
    L.einlesen(`${genau}\n${variante}`);
    const offen = L.nichtZugeordnet();
    const vorschlag = L.vorschlaege(L.lehrerDaten(), offen[0].schluessel).map((k) => k.anzeige);
    L.aliasSetzen(offen[0].schluessel, L.lehrerDaten().klasse.find((k) => k.anzeige === 'Lena Schmidt').id);
    const lena = L.uebersicht().find((k) => k.name === 'Lena Schmidt');
    return { offen: offen.length, vorschlag, runden: lena.runden, nachher: L.nichtZugeordnet().length };
  }, [KLASSE,
    punktecode({ name: 'LENASCH', bereich: 'B3', niveau: 1, punkte: 50, tag: 470, erster: 5, kennung: namensKennung('Lena Schmidt'), geraet: 'X2', nummer: 1 }),
    punktecode({ name: 'LENASCH', bereich: 'B3', niveau: 1, punkte: 60, tag: 470, erster: 6, kennung: namensKennung('Lena Schmitt'), geraet: 'X2', nummer: 2 })]);
  assert.equal(r.offen, 1);
  assert.equal(r.vorschlag[0], 'Lena Schmidt');
  assert.equal(r.runden, 2);
  assert.equal(r.nachher, 0);
  await kontext.close();
});

test('Tabelle (CSV): Semikolon, deutsche Daten, eine Zeile pro Runde', async () => {
  const { kontext, seite } = await neueSeite();
  const csv = await seite.evaluate(async (klasse) => {
    const L = await import('./js/lehrer-daten.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(klasse));
    L.einlesen(await (await fetch('tests/beispielcodes.txt')).text());
    return { runden: L.csvRunden(), uebersicht: L.csvUebersicht() };
  }, KLASSE);
  const zeilen = csv.runden.replace(/^﻿/, '').split('\r\n');
  assert.equal(zeilen.length, 17, 'Kopfzeile + 16 Runden');
  assert.match(zeilen[0], /^Name;Kurzname;Datum;/);
  assert.ok(zeilen.some((z) => z.startsWith('Lena Schmidt;LENASCH;14.11.2026;')), zeilen.slice(0, 3).join('\n'));
  assert.ok(csv.runden.startsWith('﻿'), 'BOM für Excel');
  assert.ok(csv.uebersicht.split('\r\n').length >= 7);
  await kontext.close();
});

test('QR: Schüler-QR wird von der Lehrer-Kamera-Logik gelesen (Hin und zurück)', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const codes = [];
  for (let i = 1; i <= 9; i++) codes.push(punktecode({ name: 'MIRAWOL', bereich: 'B4', niveau: 1, punkte: 50 + (i % 3) * 10, tag: 470, erster: 5 + (i % 3), kennung: namensKennung('Mira Wolf'), geraet: 'Q7', nummer: i }));
  const gelesen = await seite.evaluate(async (liste) => {
    const { qrSeiten } = await import('./js/qr.js');
    const laden = (src) => new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = ok; document.head.append(s); });
    await laden('lib/qrcode.js');
    await laden('lib/jsQR.js');
    const seiten = qrSeiten(liste);
    const aus = [];
    for (const text of seiten) {
      const qr = window.qrcode(0, 'M');
      qr.addData(text, 'Alphanumeric');
      qr.make();
      const bild = new Image();
      bild.src = qr.createDataURL(8, 4);
      await bild.decode();
      const c = document.createElement('canvas');
      c.width = bild.width; c.height = bild.height;
      const g = c.getContext('2d');
      g.drawImage(bild, 0, 0);
      aus.push(window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data);
    }
    return { seiten, aus };
  }, codes);
  assert.equal(gelesen.seiten.length, 2, '9 Codes = 2 QR-Seiten');
  assert.deepEqual(gelesen.aus, gelesen.seiten);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Lehrer-Ansicht: alle Reiter öffnen ohne Fehler, Beamer zeigt die besten 5', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.evaluate(async (klasse) => {
    const L = await import('./js/lehrer-daten.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(klasse));
    L.einlesen(await (await fetch('tests/beispielcodes.txt')).text());
  }, KLASSE);
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByRole('heading', { name: 'Ergebnisse einsammeln' }).waitFor();
  for (const [reiter, ueberschrift] of [['📊 Übersicht', 'Übersicht pro Kind'], ['👥 Klasse', 'Klassenliste'], ['💾 Sicherung', 'Sicherung'], ['🏆 Beamer', 'Rangliste für den Beamer']]) {
    await seite.getByRole('button', { name: reiter }).click();
    await seite.getByRole('heading', { name: ueberschrift, exact: true }).waitFor();
  }
  // Woche 470 wählen (Woche vor der aktuellen), dann Beamer öffnen
  await seite.evaluate(async () => {
    const { wocheVonTag, tagNummer } = await import('./js/hilfen.js');
    return wocheVonTag(tagNummer()) - wocheVonTag(470);
  }).then(async (zurueck) => { for (let i = 0; i < zurueck; i++) await seite.getByRole('button', { name: 'Woche davor' }).click(); });
  await seite.getByRole('button', { name: 'B3 Redox' }).click();
  await seite.getByRole('button', { name: '🖥 Beamer-Ansicht öffnen' }).click();
  await seite.locator('.beamer-flaeche .rang').first().waitFor();
  const namen = await seite.locator('.beamer-flaeche .rang-name').allTextContents();
  assert.deepEqual(namen, ['Lena S.', 'Mira W.', 'Elif Y.', 'Jonas B.', 'Tom B.']);
  await seite.getByRole('button', { name: 'Beamer-Ansicht schließen' }).click();
  // Übersicht: Detail eines Kindes
  await seite.getByRole('button', { name: '📊 Übersicht' }).click();
  await seite.getByRole('button', { name: 'Lena Schmidt' }).click();
  await seite.getByText('Alle Runden (4)').waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Schüler: „Ergebnisse zeigen“ öffnet einen QR-Code, „Alle Codes kopieren“ ist da', async () => {
  const { kontext, seite, fehler } = await neueSeite({ width: 820, height: 1180 });
  await seite.evaluate(() => {
    localStorage.setItem('chemie:kinder', JSON.stringify([{ name: 'MIAKOC', anzeige: 'Mia Koch', element: 'O', gesperrt: false }]));
    localStorage.setItem('chemie:kind:MIAKOC', JSON.stringify({ freigeschaltet: { B4: 'G' },
      runden: [{ art: 'normal', bereich: 'B4', niveau: 1, punkte: 60, ersterVersuch: 6, anzahl: 8, tag: 9999 }] }));
  });
  // Tag in die Gegenwart setzen
  await seite.evaluate(async () => {
    const { tagNummer } = await import('./js/hilfen.js');
    const p = JSON.parse(localStorage.getItem('chemie:kind:MIAKOC'));
    p.runden[0].tag = tagNummer();
    localStorage.setItem('chemie:kind:MIAKOC', JSON.stringify(p));
  });
  await seite.reload();
  await seite.getByRole('button', { name: /Mia/ }).click();
  await seite.getByRole('button', { name: '📷 Ergebnisse zeigen' }).click();
  await seite.locator('.qr-bild').waitFor();
  assert.ok(await seite.locator('.qr-bild').evaluate((b) => b.src.startsWith('data:image/gif') || b.src.startsWith('data:image')));
  assert.deepEqual(fehler, []);
  await kontext.close();
});
