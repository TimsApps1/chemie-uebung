// Lädt die Datendateien aus daten/ und prüft sie.
// Fehler werden als deutsche Hinweise mit Dateiname und Zeile gesammelt,
// fehlerhafte Aufgaben werden übersprungen – die App läuft trotzdem weiter.
import { atomeZaehlen, formelZerlegen, symboleSetzen } from './hilfen.js';
import { aufgabenErzeugen } from './erzeugen.js';

const fehlerListe = [];

export function fehler(datei, zeile, text) {
  fehlerListe.push({ datei, zeile, text });
}
export const alleFehler = () => [...fehlerListe];

// ---------- JSON mit Zeilenangabe ----------
// Safari nennt bei kaputtem JSON keine Zeile. Deshalb suchen wir die Stelle selbst.

function zeileVon(text, pos) {
  return text.slice(0, pos).split('\n').length;
}

function jsonFehlerstelle(text) {
  let i = 0;
  const leer = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const raus = (was) => { const e = new Error(was); e.pos = i; throw e; };
  const wert = () => {
    leer();
    const c = text[i];
    if (c === '{') {
      i++; leer();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        leer();
        if (text[i] !== '"') raus('Hier fehlt ein Anführungszeichen " vor einem Namen (oder ein Komma ist zu viel).');
        zeichenkette(); leer();
        if (text[i] !== ':') raus('Hier fehlt ein Doppelpunkt :');
        i++; wert(); leer();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        raus('Hier fehlt ein Komma , oder eine schließende Klammer }');
      }
    }
    if (c === '[') {
      i++; leer();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        wert(); leer();
        if (text[i] === ',') { i++; leer(); if (text[i] === ']') raus('Hier ist ein Komma zu viel vor ]'); continue; }
        if (text[i] === ']') { i++; return; }
        raus('Hier fehlt ein Komma , oder eine schließende Klammer ]');
      }
    }
    if (c === '"') return zeichenkette();
    if (c === '“' || c === '”' || c === '„') raus('Hier stehen typografische Anführungszeichen. Bitte gerade Anführungszeichen " benutzen.');
    const m = text.slice(i).match(/^(-?\d+(\.\d+)?|true|false|null)/);
    if (m) { i += m[0].length; return; }
    raus('Hier steht etwas, das nicht erlaubt ist (Text braucht Anführungszeichen ").');
  };
  const zeichenkette = () => {
    i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') { i++; return; }
      if (text[i] === '\n') raus('Ein Text ist nicht mit " abgeschlossen.');
      i++;
    }
    raus('Ein Text ist nicht mit " abgeschlossen.');
  };
  try {
    wert(); leer();
    if (i < text.length) raus('Nach dem Ende kommt noch etwas.');
    return null;
  } catch (e) {
    return { zeile: zeileVon(text, e.pos ?? 0), text: e.message };
  }
}

export async function jsonLaden(datei) {
  let roh;
  try {
    const antwort = await fetch(datei);
    if (!antwort.ok) throw new Error();
    roh = await antwort.text();
  } catch {
    fehler(datei, null, 'Die Datei fehlt oder konnte nicht geladen werden.');
    return null;
  }
  try {
    return { daten: JSON.parse(roh), roh };
  } catch {
    const stelle = jsonFehlerstelle(roh) || { zeile: null, text: 'Die Datei ist kein gültiges JSON.' };
    fehler(datei, stelle.zeile, stelle.text);
    return null;
  }
}

function zeileVonId(roh, id) {
  const pos = roh.indexOf(`"${id}"`);
  return pos < 0 ? null : zeileVon(roh, pos);
}

// ---------- Aufgaben prüfen ----------

const TYPEN = ['auswahl', 'zahl', 'sortieren', 'klappt', 'wortgleichung', 'antippen'];

function aufgabePruefen(a, kontext) {
  const probleme = [];
  const muss = (feld) => {
    if (a[feld] === undefined || a[feld] === null || a[feld] === '') probleme.push(`Feld „${feld}“ fehlt.`);
  };
  ['id', 'niveau', 'typ', 'frage', 'denkanstoss', 'erklaerung'].forEach(muss);
  if (![1, 2, 3].includes(a.niveau)) probleme.push('„niveau“ muss 1, 2 oder 3 sein.');
  if (!TYPEN.includes(a.typ)) probleme.push(`Unbekannter Typ „${a.typ}“. Erlaubt: ${TYPEN.join(', ')}.`);
  if (a.kurs !== undefined && a.kurs !== 'E') probleme.push('„kurs“ darf nur "E" sein (oder fehlen).');

  const { reihe } = kontext;
  const reiheNamen = reihe ? reihe.stoffe.map((s) => s.name) : [];
  const oxidZu = reihe ? Object.fromEntries(reihe.stoffe.filter((s) => s.oxid).map((s) => [s.oxid, s.name])) : {};

  if (a.typ === 'auswahl') {
    if (!Array.isArray(a.antworten) || a.antworten.length < 2) probleme.push('„antworten“ braucht mindestens 2 Einträge.');
    else if (!a.antworten.includes(a.richtig)) probleme.push(`„richtig“ („${a.richtig}“) steht nicht in „antworten“.`);
  }
  if (a.typ === 'zahl') {
    try {
      formelZerlegen(a.formel);
      if (a.zaehle !== 'alle' && !(a.zaehle in formelZerlegen(a.formel).atome)) probleme.push(`In ${a.formel} gibt es kein ${a.zaehle}.`);
      atomeZaehlen(a.formel, a.zaehle);
    } catch (e) { probleme.push(e.message || '„formel“ fehlt.'); }
  }
  if (a.typ === 'sortieren') {
    if (!Array.isArray(a.karten) || a.karten.length < 3) probleme.push('„karten“ braucht mindestens 3 Einträge.');
    else {
      for (const k of a.karten) if (!reiheNamen.includes(k)) probleme.push(`Karte „${k}“ steht nicht in reihe.json.`);
      const pos = a.karten.map((k) => reiheNamen.indexOf(k));
      if (pos.some((p, i) => i > 0 && p < pos[i - 1])) probleme.push('Die Karten stehen nicht in der richtigen Reihenfolge (edel → unedel).');
    }
  }
  if (a.typ === 'klappt') {
    if (!(a.oxid in oxidZu)) probleme.push(`Oxid „${a.oxid}“ steht nicht in reihe.json.`);
    if (!reiheNamen.includes(a.stoff)) probleme.push(`Stoff „${a.stoff}“ steht nicht in reihe.json.`);
    if (oxidZu[a.oxid] === a.stoff) probleme.push('Oxid und Stoff sind dasselbe Element.');
    if ((reihe?.nicht_abfragen || []).some(([o, s]) => o === a.oxid && s === a.stoff)) {
      probleme.push(`„${a.oxid} + ${a.stoff}“ soll nicht abgefragt werden.`);
    }
  }
  if (a.typ === 'wortgleichung') {
    const luecken = [...(a.links || []), ...(a.rechts || [])].filter((s) => s === '?').length;
    if (!Array.isArray(a.links) || !Array.isArray(a.rechts)) probleme.push('„links“ und „rechts“ müssen Listen sein.');
    if (!Array.isArray(a.richtig) || a.richtig.length !== luecken) probleme.push(`„richtig“ braucht genau ${luecken} Einträge (so viele ? gibt es).`);
    else if (!Array.isArray(a.auswahl) || a.richtig.some((r) => !a.auswahl.includes(r))) probleme.push('Alles aus „richtig“ muss auch in „auswahl“ stehen.');
  }
  if (a.typ === 'antippen') {
    const stoffe = [...(a.links || []), ...(a.rechts || [])];
    if (!stoffe.includes(a.richtig)) probleme.push(`„richtig“ („${a.richtig}“) steht nicht in der Gleichung.`);
  }
  if (a.warum) {
    if (!Array.isArray(a.warum.antworten) || !a.warum.antworten.includes(a.warum.richtig)) {
      probleme.push('Bei „warum“ muss „richtig“ in „antworten“ stehen.');
    }
  }
  return probleme;
}

// Klappt die Reaktion? Ein unedlerer Stoff nimmt dem Oxid eines edleren Stoffes den Sauerstoff weg.
export function klapptEs(reihe, oxid, stoff) {
  const namen = reihe.stoffe.map((s) => s.name);
  const oxidElement = reihe.stoffe.find((s) => s.oxid === oxid)?.name;
  return namen.indexOf(stoff) > namen.indexOf(oxidElement);
}

export { aufgabePruefen };

export function richtigeZahl(a) {
  return atomeZaehlen(a.formel, a.zaehle).gesamt;
}

// ---------- Alles laden ----------

export async function allesLaden() {
  fehlerListe.length = 0;
  const [app, bereiche, elemente, reihe, fachwoerter] = await Promise.all([
    jsonLaden('daten/app.json'),
    jsonLaden('daten/bereiche.json'),
    jsonLaden('daten/elemente.json'),
    jsonLaden('daten/reihe.json'),
    jsonLaden('daten/fachwoerter.json')
  ]);
  const d = {
    app: app?.daten || {},
    bereiche: bereiche?.daten?.bereiche || [],
    elemente: elemente?.daten?.elemente || [],
    reihe: reihe?.daten || null,
    fachwoerter: fachwoerter?.daten?.woerter || [],
    aufgaben: {}
  };
  if (d.elemente.length) symboleSetzen(d.elemente.map((e) => e.symbol));

  for (const b of d.bereiche) {
    if (b.kommt_bald) { d.aufgaben[b.id] = []; continue; }
    const datei = `daten/aufgaben/${b.id.toLowerCase()}.json`;
    const geladen = await jsonLaden(datei);
    const liste = geladen?.daten?.aufgaben;
    if (geladen && !Array.isArray(liste)) fehler(datei, 1, 'Es fehlt die Liste "aufgaben": [ ... ].');
    const gesehen = new Set();
    d.aufgaben[b.id] = (liste || []).filter((a) => {
      const zeile = zeileVonId(geladen.roh, a?.id);
      const probleme = aufgabePruefen(a || {}, d);
      if (a?.id && gesehen.has(a.id)) probleme.push(`Die id „${a.id}“ gibt es doppelt.`);
      gesehen.add(a?.id);
      if (probleme.length) {
        fehler(datei, zeile, `Aufgabe ${a?.id || '(ohne id)'}: ${probleme.join(' ')} Die Aufgabe wird übersprungen.`);
        return false;
      }
      return true;
    });
  }
  aufgabenErzeugen(d);
  return d;
}
