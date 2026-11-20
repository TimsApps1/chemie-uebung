// Daten der Lehrkraft: eingelesene Punktecodes, Klassenliste, Zuordnungen, Auswertung.
// Alles liegt nur auf dem iPad der Lehrkraft (localStorage). Sicherung über Export/Import.
import { lesen, schreiben } from './speicher.js';
import { punktecodeLesen, namensKennung } from './codes.js';
import { kurzname, tagNummer, wocheVonTag, datumVonTag } from './hilfen.js';

// Beginn des laufenden Schulhalbjahres (01.08. oder 01.02.) als Tag-Nummer.
export function halbjahresBeginn(tag = tagNummer()) {
  const START = Date.UTC(2025, 7, 1);
  const d = new Date(START + tag * 86400000);
  const jahr = d.getUTCFullYear();
  const beginn = d.getUTCMonth() >= 7 ? Date.UTC(jahr, 7, 1) : d.getUTCMonth() >= 1 ? Date.UTC(jahr, 1, 1) : Date.UTC(jahr - 1, 7, 1);
  return Math.round((beginn - START) / 86400000);
}

const SCHLUESSEL = 'lehrer';
export const ERINNERUNG_TAGE = 7;

function leer() {
  return { version: 1, runden: [], klasse: [], alias: {}, geloescht: [], letzteSicherung: null, ersteDaten: null };
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
  const bericht = { neu: [], doppelt: [], ungueltig: [], geloescht: [], speicherVoll: false };
  const geloescht = new Set(d.geloescht || []);
  const gefunden = codesAusText(text);
  for (const code of gefunden) {
    const r = punktecodeLesen(code);
    if (!r.ok) { bericht.ungueltig.push({ code, grund: r.grund }); continue; }
    if (vorhanden.has(r.code)) { bericht.doppelt.push(r.code); continue; }
    if (geloescht.has(r.code)) { bericht.geloescht.push(r.code); continue; }
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
    if (!speichern(d)) { bericht.speicherVoll = true; bericht.neu = []; }
  }
  return bericht;
}

// Gelöschte Runden werden gemerkt, damit sie beim nächsten Einlesen nicht zurückkommen.
export function rundeLoeschen(code) {
  const d = lehrerDaten();
  d.runden = d.runden.filter((r) => r.code !== code);
  d.geloescht = [...new Set([...(d.geloescht || []), code])];
  return speichern(d);
}

// ---------- Klassenliste ----------
// Eine Zeile pro Kind: "Vorname Nachname" und optional "; E" oder "; G".

// Eine Zeile zerlegen. Funktioniert auch mit Spalten aus Numbers/Excel (Tab) und mit „Nachname, Vorname“.
// Der Kurs zählt nur, wenn das letzte Feld genau G oder E ist.
export function klassenZeile(zeile) {
  let felder = String(zeile).split(/[;,\t]/).map((f) => f.trim()).filter(Boolean);
  let kurs = '';
  if (felder.length > 1 && /^[ge]$/i.test(felder[felder.length - 1])) kurs = felder.pop().toUpperCase();
  // Kurs am Ende ohne Trennzeichen: "Lena Schmidt G"
  if (!kurs && felder.length === 1) {
    const m = felder[0].match(/^(.+\S)\s+([GgEe])$/);
    if (m && m[1].includes(' ')) { felder = [m[1]]; kurs = m[2].toUpperCase(); }
  }
  // "Schmidt, Lena" -> "Lena Schmidt" (nur bei Komma, Tab-Spalten bleiben in ihrer Reihenfolge)
  let anzeige;
  if (felder.length === 2 && /^[^,]+,[^,]+/.test(zeile) && !/[;\t]/.test(zeile.split(',')[0])) anzeige = `${felder[1]} ${felder[0]}`;
  else anzeige = felder.join(' ');
  anzeige = anzeige.replace(/\s+/g, ' ').trim();
  return { anzeige, kurs, einWort: !anzeige.includes(' ') };
}

export function klasseAusText(text) {
  // Die ID hängt nur am Namen (nicht an der Zeile): Einfügen oder Löschen von Zeilen ändert nichts.
  const vergeben = new Set();
  return String(text || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean).map((zeile) => {
    const { anzeige, kurs } = klassenZeile(zeile);
    const kurz = kurzname(anzeige);
    const kennung = namensKennung(anzeige);
    let id = `${kurz}-${kennung}`;
    for (let n = 2; vergeben.has(id); n++) id = `${kurz}-${kennung}-${n}`;
    vergeben.add(id);
    return { id, anzeige, kurz, kennung, kurs, einWort: !anzeige.includes(' ') };
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
  return speichern(d);
}

// Wer hat diese Runde gespielt? Liefert die Kind-ID oder null (= nicht zugeordnet).
export const rundenSchluessel = (r) => `${r.name}|${r.kennung || ''}`;

export function kindVonRunde(d, r) {
  const s = rundenSchluessel(r);
  if (!d.klasse.length) return `?${s}`; // ohne Klassenliste: jede Kennung ist ein eigenes Kind
  // Zuordnung nur nutzen, wenn es das Kind in der Klassenliste (noch) gibt.
  if (d.alias[s] && d.klasse.some((k) => k.id === d.alias[s])) return d.alias[s];
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
export function bestenliste(d, { bereich, niveau, woche, kurs = '' }, anzahl = 5) {
  const nachKind = rundenNachKind(d);
  const werte = [];
  for (const [id, runden] of nachKind) {
    const passend = runden.filter((r) => r.bereich === bereich && r.niveau === niveau && wocheVonTag(r.tag) === woche && (!kurs || r.kurs === kurs));
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
// abTag: nur Runden ab diesem Tag (z. B. Beginn des Halbjahres).
export function uebersicht(d = lehrerDaten(), { abTag = null } = {}) {
  const nachKind = rundenNachKind(d);
  const woche = aktuelleWoche();
  return [...nachKind.entries()].map(([id, alleRunden]) => {
    const runden = abTag === null ? alleRunden : alleRunden.filter((r) => r.tag >= abTag);
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

// Lernverlauf eines Kindes für einen Bereich und ein Niveau: je Woche Bestwert, Schnitt und
// Anteil beim 1. Versuch richtig. (Misst Können, nicht Fleiß – die Zahl der Runden steht getrennt.)
export function verlauf(runden, { bereich, niveau, wochen = 8 } = {}) {
  const heute = aktuelleWoche();
  const passend = runden.filter((r) => (!bereich || r.bereich === bereich) && (!niveau || r.niveau === niveau));
  return Array.from({ length: wochen }, (_, i) => {
    const w = heute - wochen + 1 + i;
    const rw = passend.filter((r) => wocheVonTag(r.tag) === w);
    const mitErst = rw.filter((r) => r.erster !== null && r.erster !== undefined);
    return {
      woche: w, runden: rw.length,
      best: rw.length ? Math.max(...rw.map((r) => r.punkte)) : null,
      schnitt: rw.length ? Math.round(rw.reduce((s, r) => s + r.punkte, 0) / rw.length) : null,
      ersterQuote: mitErst.length ? Math.round((mitErst.reduce((s, r) => s + r.erster, 0) / (mitErst.length * 8)) * 100) : null
    };
  });
}

// Welche Bereich/Niveau-Kombinationen hat ein Kind gespielt?
export function gespielteNiveaus(runden) {
  const s = new Set(runden.map((r) => `${r.bereich}|${r.niveau}`));
  return [...s].map((x) => { const [bereich, n] = x.split('|'); return { bereich, niveau: Number(n) }; })
    .sort((a, b) => a.bereich.localeCompare(b.bereich) || a.niveau - b.niveau);
}

// Eine ganze Gruppe nicht zugeordneter Runden verwerfen (Quatschnamen, Testnamen, Abgänge).
export function gruppeVerwerfen(schluessel) {
  const d = lehrerDaten();
  const weg = d.runden.filter((r) => rundenSchluessel(r) === schluessel).map((r) => r.code);
  d.runden = d.runden.filter((r) => rundenSchluessel(r) !== schluessel);
  d.geloescht = [...new Set([...(d.geloescht || []), ...weg])];
  delete d.alias[schluessel];
  return speichern(d) ? weg.length : 0;
}

export function zuordnungen(d = lehrerDaten()) {
  return Object.entries(d.alias).map(([schluessel, id]) => ({
    schluessel, id, name: kindName(d, id), gueltig: d.klasse.some((k) => k.id === id),
    runden: d.runden.filter((r) => rundenSchluessel(r) === schluessel).length
  }));
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

export function csvUebersicht(d = lehrerDaten(), optionen = {}) {
  const kopf = ['Name', 'Runden gesamt', 'Runden diese Woche'];
  for (const b of ['B4', 'B3']) for (const n of [1, 2, 3]) kopf.push(`${b} Niveau ${n}: Runden`, `${b} Niveau ${n}: Bestwert`, `${b} Niveau ${n}: Schnitt`, `${b} Niveau ${n}: 1. Versuch %`);
  const zeilen = uebersicht(d, optionen).map((k) => {
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

// Inhalt der Sicherung (ohne Nebenwirkung). Erst nach erfolgreichem Speichern sicherungGespeichert() aufrufen.
export function sicherungErstellen() {
  const d = lehrerDaten();
  return JSON.stringify({ art: 'chemie-uebung-sicherung', version: 1, erstellt: new Date().toISOString(), daten: d }, null, 1);
}

export function sicherungGespeichert() {
  const d = lehrerDaten();
  d.letzteSicherung = Date.now();
  speichern(d);
}

// Führt eine Sicherung mit den vorhandenen Daten zusammen (nichts geht verloren).
export function sicherungEinlesen(text) {
  let inhalt;
  try { inhalt = JSON.parse(text); } catch { return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' }; }
  if (inhalt?.art !== 'chemie-uebung-sicherung' || !inhalt.daten) return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' };
  const d = lehrerDaten();
  const vorhanden = new Set(d.runden.map((r) => r.code));
  d.geloescht = [...new Set([...(d.geloescht || []), ...(inhalt.daten.geloescht || [])])];
  const geloescht = new Set(d.geloescht);
  let neu = 0;
  for (const r of inhalt.daten.runden || []) {
    if (!r?.code || vorhanden.has(r.code) || geloescht.has(r.code) || !punktecodeLesen(r.code).ok) continue;
    d.runden.push(r);
    vorhanden.add(r.code);
    neu++;
  }
  if (!d.klasse.length && Array.isArray(inhalt.daten.klasse)) d.klasse = inhalt.daten.klasse;
  d.alias = { ...(inhalt.daten.alias || {}), ...d.alias };
  d.ersteDaten = d.ersteDaten || inhalt.daten.ersteDaten || Date.now();
  if (!speichern(d)) return { ok: false, grund: 'Der Speicher auf diesem iPad ist voll.' };
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
