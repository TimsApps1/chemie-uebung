// Tests für Etappe 5: Duell, Teams, Am meisten verbessert, Klassenziel, Abzeichen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { starten, PFAD } from './server.mjs';
import { punktecode, namensKennung, pinPruefsumme } from '../js/codes.js';
import { kurzname } from '../js/hilfen.js';

const { chromium } = createRequire(import.meta.url)('playwright');

let server, browser, basis;
before(async () => {
  server = await starten(0);
  basis = `http://127.0.0.1:${server.address().port}${PFAD}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function neueSeite(viewport = { width: 820, height: 1180 }) {
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

const NAMEN = ['Ada Ahorn', 'Bea Birke', 'Cem Celik', 'Dana Dorn', 'Eli Eiche', 'Finn Fuchs'];
// Plausible Codes: punkte = 10 * erster + 5 * (8 - erster)
const code = (n, { bereich = 'B3', niveau = 1, erster, tag, nummer }) => punktecode({
  name: kurzname(n), bereich, niveau, punkte: 10 * erster + 5 * (8 - erster), tag, kurs: 'G', erster, kennung: namensKennung(n), geraet: 'AB', nummer
});

test('Am meisten verbessert: erst ab 2 Runden, Vergleich mit dem eigenen Bestwert der Wochen davor', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  // Woche von Tag 470 und die Woche davor (Tag 463)
  const codes = [
    code('Ada Ahorn', { erster: 4, tag: 463, nummer: 1 }), code('Ada Ahorn', { erster: 8, tag: 470, nummer: 2 }), code('Ada Ahorn', { erster: 6, tag: 471, nummer: 3 }), // 60 -> 80: +20
    code('Bea Birke', { erster: 6, tag: 463, nummer: 4 }), code('Bea Birke', { erster: 7, tag: 470, nummer: 5 }), code('Bea Birke', { erster: 5, tag: 470, nummer: 6 }), // 70 -> 75: +5
    code('Cem Celik', { erster: 2, tag: 463, nummer: 7 }), code('Cem Celik', { erster: 8, tag: 470, nummer: 8 }), // nur 1 Runde diese Woche -> nicht dabei
    code('Dana Dorn', { erster: 8, tag: 463, nummer: 9 }), code('Dana Dorn', { erster: 6, tag: 470, nummer: 10 }), code('Dana Dorn', { erster: 6, tag: 471, nummer: 11 }) // schlechter -> nicht dabei
  ];
  const r = await seite.evaluate(async ({ codes, namen }) => {
    const L = await import('./js/lehrer-daten.js');
    const { wocheVonTag } = await import('./js/hilfen.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(namen.join('\n')));
    L.einlesen(codes.join('\n'));
    return L.amMeistenVerbessert(L.lehrerDaten(), { bereich: 'B3', niveau: 1, woche: wocheVonTag(470) }).map((w) => `${w.name} +${w.plus}`);
  }, { codes, namen: NAMEN });
  assert.deepEqual(r, ['Ada A. +20', 'Bea B. +5']);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Teams: Teamwert ist der Durchschnitt, Vorschlag mischt stark und schwach, Sicherung enthält Teams', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const codes = [
    code('Ada Ahorn', { erster: 8, tag: 470, nummer: 1 }),   // 80
    code('Bea Birke', { erster: 4, tag: 470, nummer: 2 }),   // 60
    code('Cem Celik', { erster: 6, tag: 470, nummer: 3 })    // 70, Dana ohne Runde
  ];
  const r = await seite.evaluate(async ({ codes, namen }) => {
    const L = await import('./js/lehrer-daten.js');
    const { wocheVonTag } = await import('./js/hilfen.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(namen.join('\n')));
    L.einlesen(codes.join('\n'));
    const d0 = L.lehrerDaten();
    const { teams, unbekannt } = L.teamsAusText('Rot: Ada Ahorn, Bea Birke\nBlau: Cem Celik, Dana Dorn, Niemand Da', d0.klasse);
    L.teamsSetzen(teams);
    const werte = L.teamWerte(L.lehrerDaten(), { woche: wocheVonTag(470) });
    const vorschlag = L.teamVorschlag(L.lehrerDaten(), 2).map((t) => t.mitglieder.length);
    const sicherung = JSON.parse(L.sicherungErstellen());
    L.allesLoeschen();
    L.sicherungEinlesen(JSON.stringify(sicherung));
    return { werte, unbekannt, vorschlag, teamsNachLaden: L.lehrerDaten().teams.length };
  }, { codes, namen: NAMEN });
  assert.deepEqual(r.werte.map((t) => `${t.name} ${t.wert} ${t.aktiv}/${t.mitglieder}`), ['Rot 70 2/2', 'Blau 35 1/2']);
  assert.deepEqual(r.unbekannt, ['Niemand Da']);
  assert.deepEqual(r.vorschlag, [3, 3]);
  assert.equal(r.teamsNachLaden, 2);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Klassenziel: Summe aller Punkte der Woche, Ziel einstellbar, Beamer zeigt alle Ansichten', async () => {
  const { kontext, seite, fehler } = await neueSeite({ width: 1024, height: 768 });
  const codes = [code('Ada Ahorn', { erster: 8, tag: 470, nummer: 1 }), code('Bea Birke', { erster: 4, tag: 470, nummer: 2 })];
  const r = await seite.evaluate(async ({ codes, namen }) => {
    const L = await import('./js/lehrer-daten.js');
    const { wocheVonTag } = await import('./js/hilfen.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(namen.join('\n')));
    L.einlesen(codes.join('\n'));
    const vorher = L.klassenStand(L.lehrerDaten(), { woche: wocheVonTag(470) });
    L.klassenzielSetzen(200);
    const nachher = L.klassenStand(L.lehrerDaten(), { woche: wocheVonTag(470) });
    return { vorher, nachher };
  }, { codes, namen: NAMEN });
  assert.equal(r.vorher.summe, 140);
  assert.equal(r.vorher.eingestellt, false);
  assert.equal(r.nachher.ziel, 200);
  assert.equal(r.nachher.anteil, 0.7);
  // Lehrer-Ansicht: Beamer-Reiter mit allen vier Ansichten
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByRole('button', { name: '🏆 Beamer' }).click();
  for (const ansicht of ['Am meisten verbessert', 'Teams', 'Klassenziel', 'Die besten 5']) {
    await seite.getByRole('button', { name: new RegExp(ansicht) }).first().click();
  }
  await seite.getByRole('button', { name: /Klassenziel/ }).first().click();
  await seite.getByRole('button', { name: /Beamer-Ansicht öffnen/ }).click();
  await seite.getByText(/von 200 Punkten/).first().waitFor();
  await seite.getByRole('button', { name: 'Beamer-Ansicht schließen' }).click();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Abzeichen: 10 Runden geübt, 5 Fehler ausgebessert, 3 Rekorde – nur einmal als neu gemeldet', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const r = await seite.evaluate(async () => {
    const P = await import('./js/profil.js');
    P.kindAnlegen('ADAAHO', 'C', 'Ada Ahorn');
    const punkte = [40, 50, 60, 70, 50, 50, 50, 50, 50, 50];
    for (const p of punkte) P.rundeSpeichern('ADAAHO', { art: 'normal', bereich: 'B4', niveau: 1, punkte: p, ersterVersuch: 4, anzahl: 8 });
    P.aendern('ADAAHO', (p) => { p.ausgebessert = 5; });
    const erst = P.neueAbzeichen('ADAAHO').map((a) => a.id);
    const nochmal = P.neueAbzeichen('ADAAHO').map((a) => a.id);
    const stand = P.abzeichenStand(P.profil('ADAAHO')).map((a) => `${a.id}:${a.wert}/${a.ziel}`);
    return { erst, nochmal, stand };
  });
  assert.deepEqual(r.erst.sort(), ['fehler5', 'rekord3', 'runden10']);
  assert.deepEqual(r.nochmal, []);
  assert.ok(r.stand.includes('runden25:10/25'));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Duell: zwei Kinder abwechselnd, eigenes Niveau, „Gut gespielt, beide!“, kein Punktecode', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.evaluate(async () => {
    const P = await import('./js/profil.js');
    P.kindAnlegen('ADAAHO', 'C', 'Ada Ahorn');
    P.kindAnlegen('BEABIR', 'O', 'Bea Birke');
    P.freischalten('ADAAHO', 'B4', 'G');
    P.freischalten('BEABIR', 'B4', 'G');
    // Für den Test nur Auswahl-Aufgaben, damit wir die richtige Antwort finden.
    const { allesLaden } = await import('./js/daten.js');
    const { duellStarten } = await import('./js/duell.js');
    const d = await allesLaden();
    d.aufgaben.B4 = d.aufgaben.B4.filter((a) => a.typ === 'auswahl' && !a.gleichung);
    window.__daten = d;
    duellStarten({ ziel: document.getElementById('inhalt'), daten: d, zurueck: () => { window.__zurueck = true; } });
  });
  await seite.getByRole('button', { name: 'Ada Ahorn' }).click();
  await seite.getByRole('button', { name: 'Bea Birke' }).click();
  await seite.getByRole('radio', { name: /drei Sterne, 3 Punkte/ }).first().click(); // Ada auf ★★★
  await seite.getByRole('button', { name: /Los geht/ }).click();
  const richtigTippen = async () => {
    const frage = (await seite.locator('.anweisung span').last().textContent()).trim();
    const wert = await seite.evaluate((f) => window.__daten.aufgaben.B4.find((a) => a.frage === f)?.richtig, frage);
    await seite.locator(`.antwort[data-wert="${wert}"]`).click();
  };
  const reihenfolge = [];
  const fragenListe = [];
  for (let zug = 0; zug < 12; zug++) {
    reihenfolge.push((await seite.locator('.duell-dran-name').textContent()).replace(' ist dran', ''));
    fragenListe.push((await seite.locator('.anweisung span').last().textContent()).trim());
    await richtigTippen();
    const weiter = seite.getByRole('button', { name: /Weiter:|Zum Ergebnis/ });
    const text = await weiter.textContent();
    await weiter.click();
    if (/Zum Ergebnis/.test(text)) break;
  }
  await seite.getByRole('heading', { name: /Gut gespielt, beide!/ }).waitFor();
  assert.deepEqual(reihenfolge.slice(0, 4), ['Ada', 'Bea', 'Ada', 'Bea'], 'abwechselnd');
  for (let i = 1; i < fragenListe.length; i++) assert.notEqual(fragenListe[i], fragenListe[i - 1], 'nie dieselbe Aufgabe direkt hintereinander');
  // Ada (★★★, 3 P.) hat nach 4 richtigen Antworten 12 ≥ 10 Punkte
  assert.match(await seite.locator('.ergebnis-satz').textContent(), /Ada hat zuerst 10 Punkte/);
  assert.equal(await seite.locator('.code').count(), 0, 'kein Punktecode');
  const runden = await seite.evaluate(async () => (await import('./js/profil.js')).profil('ADAAHO').runden.length);
  assert.equal(runden, 0, 'Duell wird nicht als Runde gespeichert');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Duell-Auswahl: nur das eigene Niveau (keine leichteren Einstiegsaufgaben)', async () => {
  const { aufgabenWaehlen } = await import('../js/runde.js');
  const fs = await import('node:fs');
  const b4 = JSON.parse(fs.readFileSync(new URL('../daten/aufgaben/b4.json', import.meta.url), 'utf8')).aufgaben;
  for (let i = 0; i < 50; i++) {
    assert.ok(aufgabenWaehlen(b4, 3, 'E', [], { ohneEinstieg: true }).every((a) => a.niveau === 3));
  }
});

test('Teams: gleicher Wert = gleicher Platz, Abgänge zählen nicht, kein „null“ im Editor, Beamer verrät nicht, wer nicht geübt hat', async () => {
  const { kontext, seite, fehler } = await neueSeite({ width: 1024, height: 768 });
  const codes = [code('Ada Ahorn', { erster: 8, tag: 470, nummer: 1 }), code('Cem Celik', { erster: 8, tag: 470, nummer: 2 })];
  const r = await seite.evaluate(async ({ codes, namen }) => {
    const L = await import('./js/lehrer-daten.js');
    const { wocheVonTag } = await import('./js/hilfen.js');
    L.allesLoeschen();
    L.klasseSpeichern(L.klasseAusText(namen.join('\n')));
    L.einlesen(codes.join('\n'));
    const d0 = L.lehrerDaten();
    L.teamsSetzen(L.teamsAusText('Rot: Ada Ahorn, Bea Birke\nBlau: Cem Celik, Dana Dorn', d0.klasse).teams);
    const gleich = L.teamWerte(L.lehrerDaten(), { woche: wocheVonTag(470) }).map((t) => `${t.platz}:${t.wert}`);
    // Bea verlässt die Klasse
    L.klasseSpeichern(L.klasseAusText(namen.filter((n) => n !== 'Bea Birke').join('\n')));
    const nachAbgang = L.teamWerte(L.lehrerDaten(), { woche: wocheVonTag(470) }).map((t) => `${t.name}:${t.wert}:${t.mitglieder}`);
    return { gleich, nachAbgang, text: L.teamsAlsText() };
  }, { codes, namen: NAMEN });
  assert.deepEqual(r.gleich, ['1:40', '1:40']);
  assert.deepEqual(r.nachAbgang, ['Rot:80:1', 'Blau:40:2']);
  assert.doesNotMatch(r.text, /-[A-Z0-9]{2}\b/, 'keine technischen IDs im Teams-Text');
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByRole('button', { name: '🏆 Beamer' }).click();
  await seite.getByRole('button', { name: /👥 Teams/ }).first().click();
  assert.doesNotMatch(await seite.locator('main, body').first().innerText(), /\bnull\b/);
  await seite.getByRole('button', { name: '👥 Klasse' }).click();
  assert.doesNotMatch(await seite.locator('body').innerText(), /\bnull\b/);
  await seite.getByRole('button', { name: '🏆 Beamer' }).click();
  await seite.getByRole('button', { name: /Beamer-Ansicht öffnen/ }).click();
  const beamer = await seite.locator('.beamer-flaeche').innerText();
  assert.doesNotMatch(beamer, /von \d+ haben geübt/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Teams: mehrdeutige Vornamen werden nicht geraten', async () => {
  const { kontext, seite } = await neueSeite();
  const r = await seite.evaluate(async () => {
    const L = await import('./js/lehrer-daten.js');
    const klasse = L.klasseAusText('Lena Schmidt\nLena Schneider\nTom Berg');
    return L.teamsAusText('Rot: Lena, Tom', klasse);
  });
  assert.equal(r.teams[0].mitglieder.length, 1, 'nur Tom');
  assert.equal(r.mehrdeutig.length, 1);
  await kontext.close();
});

test('Von der Startseite zurück zu „Wer übt?“: Knopf oben links und „Anderer Name“', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  await seite.evaluate(async () => {
    const P = await import('./js/profil.js');
    P.kindAnlegen('ADAAHO', 'C', 'Ada Ahorn');
    P.kindAnlegen('BEABIR', 'O', 'Bea Birke');
    location.reload();
  });
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  await seite.getByRole('button', { name: 'Ada Ahorn' }).click();
  await seite.getByRole('heading', { name: /Hallo Ada/ }).waitFor();
  await seite.getByRole('button', { name: /zurück zu „Wer übt\?“/ }).click();
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  await seite.getByRole('button', { name: 'Bea Birke' }).click();
  await seite.getByRole('button', { name: '👋 Anderer Name' }).click();
  await seite.getByRole('heading', { name: 'Wer übt?' }).waitFor();
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('iPad-Sicherung: Kinder sichern, iPad leeren, zurückholen – ohne doppelte Runden', async () => {
  const { kontext, seite, fehler } = await neueSeite();
  const r = await seite.evaluate(async () => {
    const P = await import('./js/profil.js');
    P.kindAnlegen('ADAAHO', 'C', 'Ada Ahorn');
    P.freischalten('ADAAHO', 'B3', 'E');
    P.rundeSpeichern('ADAAHO', { art: 'normal', bereich: 'B3', niveau: 2, punkte: 70, ersterVersuch: 6, anzahl: 8 });
    P.fehlerMerken('ADAAHO', { id: 'b3-2-01' }, 'B3');
    const kennung = P.geraet().kennung;
    const datei = P.ipadSicherungErstellen();
    P.kindLoeschen('ADAAHO');
    localStorage.removeItem('chemie:geraet');
    const ergebnis = P.ipadSicherungEinlesen(datei);
    const nochmal = P.ipadSicherungEinlesen(datei);
    const p = P.profil('ADAAHO');
    const falsch = P.ipadSicherungEinlesen(JSON.stringify({ art: 'chemie-uebung-sicherung', daten: {} }));
    return { ergebnis, nochmal, runden: p.runden.length, fehler: Object.keys(p.fehler), frei: p.freigeschaltet.B3,
      name: P.kindEintrag('ADAAHO')?.anzeige, kennungGleich: P.geraet().kennung === kennung, falsch };
  });
  assert.equal(r.ergebnis.ok, true);
  assert.equal(r.ergebnis.neueKinder, 1);
  assert.equal(r.nochmal.neueRunden, 0, 'zweites Laden doppelt nichts');
  assert.equal(r.runden, 1);
  assert.deepEqual(r.fehler, ['b3-2-01']);
  assert.equal(r.frei, 'E');
  assert.equal(r.name, 'Ada Ahorn');
  assert.equal(r.kennungGleich, true, 'iPad-Kennung kommt auf ein leeres iPad zurück');
  assert.match(r.falsch.grund, /Lehrkraft-Ergebnisse/);
  // In der Lehrer-Ansicht sichtbar
  await seite.getByRole('button', { name: 'Lehrkraft' }).click();
  for (const z of '4711') await seite.getByRole('button', { name: z, exact: true }).click();
  await seite.getByRole('button', { name: 'OK' }).click();
  await seite.getByRole('button', { name: '📱 Dieses iPad' }).click();
  await seite.getByRole('button', { name: '💾 iPad sichern' }).waitFor();
  assert.match(await seite.locator('body').innerText(), /noch nie gesichert/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});
