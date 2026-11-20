// Daten der Lehrkraft: eingelesene Punktecodes, Klassenliste, Zuordnungen, Auswertung.
// Alles liegt nur auf dem iPad der Lehrkraft (localStorage). Sicherung über Export/Import.
import { lesen, schreiben } from './speicher.js';
import { punktecodeLesen, namensKennung } from './codes.js';
import { kurzname, tagNummer, wocheVonTag, datumVonTag } from './hilfen.js';

const SCHLUESSEL = 'lehrer';
export const ERINNERUNG_TAGE = 7;

function leer() {
  return { version: 1, runden: [], klasse: [], alias: {}, letzteSicherung: null, ersteDaten: null };
}

export function lehrerDaten() {
  return { ...leer(), ...(lesen(SCHLUESSEL, {}) || {}) };
}

function speichern(d) {
  return schreiben(SCHLUESSEL, d);
}

// ---------- Codes aus beliebigem Text finden (z. B. ganze Classroom-Seite) ----------

const MUSTER = /(?:^|[^A-Z0-9])([A-Z0-9]{1,8}-B[1-4]-[1-3]-\d{4}-\d{4}-(?:[GE]\d\d-[A-Z0-9]{2}-[A-Z0-9]{2}-\d{3}-)?[A-Z0-9]{3})(?![A-Z0-9-])/g;

export function codesAusText(text) {
  const gross = String(text || '').toUpperCase().replace(/[‐‑–—]/g, '-');
  const gefunden = [];
  let m;
  MUSTER.lastIndex = 0;
  while ((m = MUSTER.exec(gross))) {
    gefunden.push(m[1]);
    MUSTER.lastIndex = m.index + m[0].length;
  }
  return gefunden;
}

// Etwas, das wie ein Code aussieht, aber nicht ganz passt (für die Fehlerliste).
export function fastCodes(text) {
  const gross = String(text || '').toUpperCase().replace(/[‐‑–—]/g, '-');
  return (gross.match(/[A-Z0-9]{1,10}-B\d-\d-[A-Z0-9-]{8,40}/g) || []);
}

// ---------- Einlesen ----------
// Liefert einen Bericht: { neu, doppelt, ungueltig: [{ code, grund }] }

export function einlesen(text, quelle = 'text') {
  const d = lehrerDaten();
  const vorhanden = new Set(d.runden.map((r) => r.code));
  const bericht = { neu: [], doppelt: [], ungueltig: [] };
  const gefunden = codesAusText(text);
  for (const code of gefunden) {
    const r = punktecodeLesen(code);
    if (!r.ok) { bericht.ungueltig.push({ code, grund: r.grund }); continue; }
    if (vorhanden.has(r.code)) { bericht.doppelt.push(r.code); continue; }
    if (r.tag > tagNummer() + 1) { bericht.ungueltig.push({ code, grund: 'Datum liegt in der Zukunft' }); continue; }
    vorhanden.add(r.code);
    const runde = {
      code: r.code, name: r.name, kennung: r.kennung, bereich: r.bereich, niveau: r.niveau, punkte: r.punkte,
      tag: r.tag, kurs: r.kurs, erster: r.erster, warum: r.warum, geraet: r.geraet, nummer: r.nummer,
      quelle, eingelesen: Date.now()
    };
    d.runden.push(runde);
    bericht.neu.push(runde);
  }
  // Codes, die fast passen (z. B. abgeschnitten), als ungültig melden.
  const gueltigeTexte = new Set(gefunden);
  for (const f of fastCodes(text)) {
    if (!gueltigeTexte.has(f)) bericht.ungueltig.push({ code: f, grund: 'Code ist unvollständig oder falsch abgetippt' });
  }
  if (bericht.neu.length) {
    d.ersteDaten = d.ersteDaten || Date.now();
    speichern(d);
  }
  return bericht;
}

export function rundeLoeschen(code) {
  const d = lehrerDaten();
  d.runden = d.runden.filter((r) => r.code !== code);
  speichern(d);
}

// ---------- Klassenliste ----------
// Eine Zeile pro Kind: "Vorname Nachname" und optional "; E" oder "; G".

export function klasseAusText(text) {
  return String(text || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean).map((zeile, i) => {
    const [namensTeil, kursTeil] = zeile.split(/[;,\t]/);
    const anzeige = namensTeil.trim().replace(/\s+/g, ' ');
    const kurs = /^\s*e\s*$/i.test(kursTeil || '') ? 'E' : /^\s*g\s*$/i.test(kursTeil || '') ? 'G' : '';
    return { id: `k${i + 1}-${kurzname(anzeige)}`, anzeige, kurz: kurzname(anzeige), kennung: namensKennung(anzeige), kurs };
  }).filter((k) => k.kurz);
}

export function klasseSpeichern(liste) {
  const d = lehrerDaten();
  d.klasse = liste;
  speichern(d);
}

export function aliasSetzen(schluessel, kindId) {
  const d = lehrerDaten();
  if (kindId) d.alias[schluessel] = kindId;
  else delete d.alias[schluessel];
  speichern(d);
}

// Wer hat diese Runde gespielt? Liefert die Kind-ID oder null (= nicht zugeordnet).
export const rundenSchluessel = (r) => `${r.name}|${r.kennung || ''}`;

export function kindVonRunde(d, r) {
  const s = rundenSchluessel(r);
  if (d.alias[s]) return d.alias[s];
  if (!d.klasse.length) return `?${s}`; // ohne Klassenliste: jede Kennung ist ein eigenes Kind
  const genau = d.klasse.filter((k) => k.kurz === r.name && k.kennung === r.kennung);
  if (genau.length === 1) return genau[0].id;
  return null;
}

// Vorschläge für nicht zugeordnete Runden: Kinder mit gleichem Kurznamen zuerst.
export function vorschlaege(d, schluessel) {
  const kurz = schluessel.split('|')[0];
  const gleich = d.klasse.filter((k) => k.kurz === kurz);
  const aehnlich = d.klasse.filter((k) => k.kurz !== kurz && k.kurz.slice(0, 4) === kurz.slice(0, 4));
  return [...gleich, ...aehnlich];
}

export function nichtZugeordnet(d = lehrerDaten()) {
  const gruppen = new Map();
  for (const r of d.runden) {
    if (kindVonRunde(d, r)) continue;
    const s = rundenSchluessel(r);
    gruppen.set(s, [...(gruppen.get(s) || []), r]);
  }
  return [...gruppen.entries()].map(([schluessel, runden]) => ({ schluessel, runden }));
}

// Anzeigename eines Kindes
export function kindName(d, id) {
  const k = d.klasse.find((x) => x.id === id);
  if (k) return k.anzeige;
  return String(id).replace(/^\?/, '').replace(/\|.*$/, '');
}

// Kurzer Name für den Beamer: "Lena S."
export function beamerName(d, id) {
  const k = d.klasse.find((x) => x.id === id);
  if (!k) return kindName(d, id);
  const teile = k.anzeige.split(' ');
  return teile.length > 1 ? `${teile[0]} ${teile[teile.length - 1][0]}.` : teile[0];
}

// ---------- Auswertung ----------

export function rundenNachKind(d = lehrerDaten()) {
  const karte = new Map();
  for (const k of d.klasse) karte.set(k.id, []);
  for (const r of d.runden) {
    const id = kindVonRunde(d, r);
    if (!id) continue;
    karte.set(id, [...(karte.get(id) || []), r]);
  }
  for (const liste of karte.values()) liste.sort((a, b) => a.tag - b.tag || (a.nummer || 0) - (b.nummer || 0));
  return karte;
}

// Wochenwert = Summe der 3 besten Runden der Woche (pro Kind, Bereich, Niveau).
export function wochenwert(runden) {
  return [...runden].map((r) => r.punkte).sort((a, b) => b - a).slice(0, 3).reduce((s, p) => s + p, 0);
}

export function aktuelleWoche() {
  return wocheVonTag(tagNummer());
}

export function wochenText(woche) {
  return `${datumVonTag(woche * 7 - 4)} – ${datumVonTag(woche * 7 + 2)}`;
}

// Die besten 5 einer Woche für Bereich + Niveau. Gleicher Wert = gleicher Platz.
export function bestenliste(d, { bereich, niveau, woche }, anzahl = 5) {
  const nachKind = rundenNachKind(d);
  const werte = [];
  for (const [id, runden] of nachKind) {
    const passend = runden.filter((r) => r.bereich === bereich && r.niveau === niveau && wocheVonTag(r.tag) === woche);
    if (!passend.length) continue;
    werte.push({ id, name: beamerName(d, id), wert: wochenwert(passend), runden: passend.length });
  }
  werte.sort((a, b) => b.wert - a.wert || a.name.localeCompare(b.name));
  let platz = 0;
  let letzter = null;
  return werte.map((w, i) => {
    if (w.wert !== letzter) { platz = i + 1; letzter = w.wert; }
    return { ...w, platz };
  }).filter((w) => w.platz <= anzahl);
}

// Übersicht pro Kind und Bereich (für die Lehrkraft, nicht für den Beamer).
export function uebersicht(d = lehrerDaten()) {
  const nachKind = rundenNachKind(d);
  const woche = aktuelleWoche();
  return [...nachKind.entries()].map(([id, runden]) => {
    const proBereich = {};
    for (const b of ['B4', 'B3', 'B1', 'B2']) {
      const rb = runden.filter((r) => r.bereich === b);
      if (!rb.length) continue;
      const proNiveau = {};
      for (const n of [1, 2, 3]) {
        const rn = rb.filter((r) => r.niveau === n);
        if (!rn.length) continue;
        const mitErst = rn.filter((r) => r.erster !== null && r.erster !== undefined);
        proNiveau[n] = {
          runden: rn.length,
          best: Math.max(...rn.map((r) => r.punkte)),
          schnitt: Math.round(rn.reduce((s, r) => s + r.punkte, 0) / rn.length),
          ersterQuote: mitErst.length ? Math.round((mitErst.reduce((s, r) => s + r.erster, 0) / (mitErst.length * 8)) * 100) : null
        };
      }
      proBereich[b] = { runden: rb.length, proNiveau, kurs: rb.some((r) => r.kurs === 'E') ? 'E' : rb.some((r) => r.kurs === 'G') ? 'G' : '' };
    }
    const letzte = runden[runden.length - 1];
    return {
      id, name: kindName(d, id), runden: runden.length, proBereich,
      dieseWoche: runden.filter((r) => wocheVonTag(r.tag) === woche).length,
      letzterTag: letzte ? letzte.tag : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Verlauf: Wochenwerte der letzten Wochen für ein Kind (je Bereich das höchste Niveau der Woche).
export function verlauf(runden, wochen = 8) {
  const heute = aktuelleWoche();
  return Array.from({ length: wochen }, (_, i) => {
    const w = heute - wochen + 1 + i;
    const rw = runden.filter((r) => wocheVonTag(r.tag) === w);
    return { woche: w, runden: rw.length, punkte: rw.reduce((s, r) => s + r.punkte, 0), erster: rw.reduce((s, r) => s + (r.erster || 0), 0) };
  });
}

// ---------- Tabelle (CSV) ----------
// Semikolon, deutsches Datum, BOM: öffnet sich direkt in Numbers und Excel.

function csvZelle(w) {
  const s = w === null || w === undefined ? '' : String(w);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRunden(d = lehrerDaten()) {
  const kopf = ['Name', 'Kurzname', 'Datum', 'Woche', 'Bereich', 'Niveau', 'Kurs', 'Punkte', 'Beim 1. Versuch richtig (von 8)', 'Richtige Begründungen', 'Punktecode'];
  const zeilen = d.runden.map((r) => {
    const id = kindVonRunde(d, r);
    return [id ? kindName(d, id) : '(nicht zugeordnet)', r.name, datumVonTag(r.tag), wochenText(wocheVonTag(r.tag)), r.bereich, r.niveau,
      r.kurs || '', r.punkte, r.erster ?? '', r.warum ?? '', r.code];
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).split('.').reverse().join('').localeCompare(String(b[2]).split('.').reverse().join('')));
  return '﻿' + [kopf, ...zeilen].map((z) => z.map(csvZelle).join(';')).join('\r\n');
}

export function csvUebersicht(d = lehrerDaten()) {
  const kopf = ['Name', 'Runden gesamt', 'Runden diese Woche'];
  for (const b of ['B4', 'B3']) for (const n of [1, 2, 3]) kopf.push(`${b} Niveau ${n}: Runden`, `${b} Niveau ${n}: Bestwert`, `${b} Niveau ${n}: Schnitt`, `${b} Niveau ${n}: 1. Versuch %`);
  const zeilen = uebersicht(d).map((k) => {
    const z = [k.name, k.runden, k.dieseWoche];
    for (const b of ['B4', 'B3']) for (const n of [1, 2, 3]) {
      const x = k.proBereich[b]?.proNiveau[n];
      z.push(x?.runden ?? 0, x?.best ?? '', x?.schnitt ?? '', x?.ersterQuote ?? '');
    }
    return z;
  });
  return '﻿' + [kopf, ...zeilen].map((z) => z.map(csvZelle).join(';')).join('\r\n');
}

// ---------- Sicherung ----------

export function sicherungErstellen() {
  const d = lehrerDaten();
  d.letzteSicherung = Date.now();
  speichern(d);
  return JSON.stringify({ art: 'chemie-uebung-sicherung', version: 1, erstellt: new Date().toISOString(), daten: d }, null, 1);
}

// Führt eine Sicherung mit den vorhandenen Daten zusammen (nichts geht verloren).
export function sicherungEinlesen(text) {
  let inhalt;
  try { inhalt = JSON.parse(text); } catch { return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' }; }
  if (inhalt?.art !== 'chemie-uebung-sicherung' || !inhalt.daten) return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' };
  const d = lehrerDaten();
  const vorhanden = new Set(d.runden.map((r) => r.code));
  let neu = 0;
  for (const r of inhalt.daten.runden || []) {
    if (!r?.code || vorhanden.has(r.code) || !punktecodeLesen(r.code).ok) continue;
    d.runden.push(r);
    vorhanden.add(r.code);
    neu++;
  }
  if (!d.klasse.length && Array.isArray(inhalt.daten.klasse)) d.klasse = inhalt.daten.klasse;
  d.alias = { ...(inhalt.daten.alias || {}), ...d.alias };
  d.ersteDaten = d.ersteDaten || inhalt.daten.ersteDaten || Date.now();
  speichern(d);
  return { ok: true, neu };
}

export function sicherungFaellig(d = lehrerDaten()) {
  if (!d.runden.length) return false;
  const seit = d.letzteSicherung || d.ersteDaten || Date.now();
  return Date.now() - seit > ERINNERUNG_TAGE * 86400000;
}

export function allesLoeschen() {
  speichern(leer());
}
