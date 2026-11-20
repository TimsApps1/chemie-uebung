// Freischaltcodes, Admin-PIN und Punktecodes.
import { pruefzeichen, eingabeSaeubern } from './pruefsumme.js';

// ---------- Freischaltcodes ----------
// Ein Code gilt für einen Bereich und einen Kurs. Er entsteht nach einer festen Regel
// aus Bereich, Kurs und "Serie". Neue Serie = neue Codes. So funktionieren neue Codes
// sofort auf allen iPads, und kein Code steht im Klartext im Programm.

export const KURSE_PRO_BEREICH = { B4: ['G', 'E'], B3: ['G', 'E'], B1: ['E'], B2: ['E'] };
const HOECHSTE_SERIE = 99;

export function freischaltcode(bereich, kurs, serie) {
  return pruefzeichen(`frei|${bereich}|${kurs}|${serie}`, 6);
}

// Liefert { bereich, kurs, serie } oder null.
export function freischaltcodePruefen(eingabe, abSerie = 1) {
  const code = eingabeSaeubern(eingabe).replace(/-/g, '');
  if (code.length !== 6) return null;
  for (let serie = HOECHSTE_SERIE; serie >= abSerie; serie--) {
    for (const [bereich, kurse] of Object.entries(KURSE_PRO_BEREICH)) {
      for (const kurs of kurse) {
        if (freischaltcode(bereich, kurs, serie) === code) return { bereich, kurs, serie };
      }
    }
  }
  return null;
}

// Typische Verwechslungen erklären.
export function codeTippfehlerHinweis(eingabe) {
  const c = eingabeSaeubern(eingabe);
  if (/[01OIL]/.test(c)) return 'In den Codes gibt es kein 0, O, 1, I und L. Schau noch einmal genau.';
  if (c.replace(/-/g, '').length !== 6) return 'Ein Freischaltcode hat genau 6 Zeichen.';
  return 'Dieser Code passt nicht. Frag deine Lehrkraft.';
}

// ---------- Admin-PIN ----------

export function pinPruefsumme(pin) {
  return pruefzeichen(`pin|${String(pin).trim()}`, 10);
}

export function pinPruefen(pin, gespeichert) {
  return pinPruefsumme(pin) === gespeichert;
}

// ---------- Punktecode ----------
// LENASCH-B3-3-0080-0127-E62-K3-007-XYZ
//   Name (Kurzname) · Bereich · Niveau · Punkte · Tag seit 01.08.2025
//   · Kurs (G/E) + Aufgaben beim 1. Versuch richtig (0–8) + richtige Begründungen (0–4)
//   · Namens-Kennung: 2 Zeichen aus dem VOLLEN Namen (Lena Schmidt und Lena Schneider heißen
//     beide LENASCH, haben aber verschiedene Kennungen – auf jedem iPad dieselbe)
//   · Rundennummer (001–999) · Prüfsumme
// Das ältere Format NAME-B3-2-0080-0127-XYZ wird beim Einlesen weiter akzeptiert.

const NUR_E = ['B1', 'B2'];

export function namensKennung(klarname) {
  const teile = String(klarname || '').trim().split(/\s+/).map((w) => w
    .toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')).filter(Boolean);
  return pruefzeichen(`klar|${teile.join(' ')}`, 2);
}

export function punktecode({ name, bereich, niveau, punkte, tag, kurs = 'G', erster = 0, warum = 0, kennung = '22', nummer = 1 }) {
  const begrenzt = (z, max) => Math.min(max, Math.max(0, Math.round(z || 0)));
  const teile = [name, bereich, String(niveau), String(begrenzt(punkte, 9999)).padStart(4, '0'),
    String(begrenzt(tag, 9999)).padStart(4, '0'), `${kurs === 'E' ? 'E' : 'G'}${begrenzt(erster, 9)}${begrenzt(warum, 9)}`,
    String(kennung).slice(0, 2).padEnd(2, '2'), String(((nummer - 1) % 999 + 999) % 999 + 1).padStart(3, '0')];
  return [...teile, pruefzeichen(teile.join('-'), 3)].join('-');
}

// Ist dieses Ergebnis in einer echten Runde überhaupt möglich?
export function ergebnisMoeglich({ bereich, niveau, punkte, kurs, erster, warum }) {
  const zweite = (punkte - 10 * erster - 5 * warum) / 5;
  return Number.isInteger(zweite) && zweite >= 0 && erster <= 8 && erster + zweite <= 8 &&
    (warum === 0 || niveau === 3) && warum <= 4 && warum <= erster + zweite &&
    !(kurs === 'G' && NUR_E.includes(bereich));
}

// Liefert { ok, code, name, bereich, niveau, punkte, tag, kurs, erster, warum, kennung, nummer, grund }.
export function punktecodeLesen(eingabe) {
  const code = eingabeSaeubern(eingabe);
  const neu = code.match(/^([A-Z0-9]{1,8})-(B[1-4])-([1-3])-(\d{4})-(\d{4})-([GE])(\d)(\d)-([A-Z0-9]{2})-(\d{3})-([A-Z0-9]{3})$/);
  const alt = !neu && code.match(/^([A-Z0-9]{1,8})-(B[1-4])-([1-3])-(\d{4})-(\d{4})-([A-Z0-9]{3})$/);
  if (!neu && !alt) return { ok: false, code, grund: 'Aufbau stimmt nicht' };
  const [, name, bereich, niveau, punkte, tag] = neu || alt;
  const teile = [name, bereich, niveau, punkte, tag];
  if (neu) teile.push(neu[6] + neu[7] + neu[8], neu[9], neu[10]);
  const pruef = neu ? neu[11] : alt[6];
  if (pruefzeichen(teile.join('-'), 3) !== pruef) return { ok: false, code, grund: 'Prüfsumme stimmt nicht' };
  const ergebnis = {
    ok: true, code, name, bereich, niveau: Number(niveau), punkte: Number(punkte), tag: Number(tag),
    kurs: neu ? neu[6] : null, erster: neu ? Number(neu[7]) : null, warum: neu ? Number(neu[8]) : null,
    kennung: neu ? neu[9] : null, nummer: neu ? Number(neu[10]) : null
  };
  if (neu && !ergebnisMoeglich(ergebnis)) return { ok: false, code, grund: 'Werte sind nicht möglich' };
  if (!neu && ergebnis.punkte > 100) return { ok: false, code, grund: 'Werte sind nicht möglich' };
  return ergebnis;
}
