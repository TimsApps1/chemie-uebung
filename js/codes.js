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
// LENA-B3-2-0080-0127-K9Q: Name, Bereich, Niveau, Punkte (4 Ziffern), Tag seit 01.08.2025, Prüfsumme.

export function punktecode({ name, bereich, niveau, punkte, tag }) {
  const teile = [name, bereich, String(niveau), String(punkte).padStart(4, '0'), String(tag).padStart(4, '0')];
  return [...teile, pruefzeichen(teile.join('-'), 3)].join('-');
}

// Liefert { ok, code, name, bereich, niveau, punkte, tag, grund }.
export function punktecodeLesen(eingabe) {
  const code = eingabeSaeubern(eingabe);
  const m = code.match(/^([A-Z0-9]{1,8})-(B[1-4])-([1-3])-(\d{4})-(\d{4})-([A-Z0-9]{3})$/);
  if (!m) return { ok: false, code, grund: 'Aufbau stimmt nicht' };
  const [, name, bereich, niveau, punkte, tag, pruef] = m;
  if (pruefzeichen([name, bereich, niveau, punkte, tag].join('-'), 3) !== pruef) {
    return { ok: false, code, grund: 'Prüfsumme stimmt nicht' };
  }
  return { ok: true, code, name, bereich, niveau: Number(niveau), punkte: Number(punkte), tag: Number(tag) };
}
