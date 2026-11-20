// Kleine Hilfsfunktionen, die überall gebraucht werden.

export function el(tag, eigenschaften = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(eigenschaften || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    e.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return e;
}

export function knopf(text, onclick, klasse = '') {
  return el('button', { type: 'button', class: `knopf ${klasse}`.trim(), onclick }, text);
}

export function mischen(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sterneText = (n) => '★'.repeat(n);

// ---------- Namen ----------

// Kurzname für Vor- und Nachname: Anfang des Vornamens + 3 Buchstaben des Nachnamens,
// zusammen höchstens 8 Zeichen. "Mohammed Yilmaz" -> "MOHAMYIL", "Lena Özil" -> "LENAOEZ", "Tom" -> "TOM".
export function kurzname(roh) {
  const woerter = String(roh || '').trim().split(/\s+/).filter(Boolean);
  if (woerter.length < 2) return nameVereinheitlichen(roh);
  const vor = nameVereinheitlichen(woerter[0]);
  const nach = nameVereinheitlichen(woerter[woerter.length - 1]).slice(0, 3);
  return (vor.slice(0, 8 - nach.length) + nach).slice(0, 8);
}

// "Lena-Marie Özdemir" -> "LENAMARI" (höchstens 8 Zeichen, A–Z und 0–9)
export function nameVereinheitlichen(roh) {
  return String(roh || '')
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/ẞ/g, 'SS')
    .replace(/Ł/g, 'L').replace(/Ø/g, 'OE').replace(/Æ/g, 'AE').replace(/Œ/g, 'OE')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

// ---------- Datum (deutsche Zeit) ----------

const START_UTC = Date.UTC(2025, 7, 1); // 01.08.2025

// Tage seit dem 01.08.2025 nach deutscher Uhrzeit.
export function tagNummer(datum = new Date()) {
  const teile = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(datum);
  const wert = (typ) => Number(teile.find((t) => t.type === typ).value);
  return Math.round((Date.UTC(wert('year'), wert('month') - 1, wert('day')) - START_UTC) / 86400000);
}

// Woche Montag bis Sonntag. Der 01.08.2025 war ein Freitag, Montag davor = Tag -4.
export const wocheVonTag = (tag) => Math.floor((tag + 4) / 7);

export function datumVonTag(tag) {
  const d = new Date(START_UTC + tag * 86400000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

// ---------- Formeln ----------

// "2 Al2O3" -> { faktor: 2, atome: { Al: 2, O: 3 } }
export function formelZerlegen(text) {
  const m = String(text).trim().match(/^(\d+)?\s*(.+)$/);
  const faktor = m[1] ? Number(m[1]) : 1;
  const atome = {};
  const teil = /([A-Z][a-z]?)(\d*)/g;
  let rest = m[2].replace(/\s+/g, '');
  let gefunden = '';
  let t;
  while ((t = teil.exec(rest))) {
    gefunden += t[0];
    atome[t[1]] = (atome[t[1]] || 0) + (t[2] ? Number(t[2]) : 1);
  }
  if (gefunden !== rest) throw new Error(`„${text}“ ist keine Formel, die die App versteht.`);
  return { faktor, atome };
}

export function atomeZaehlen(formel, welches = 'alle') {
  const { faktor, atome } = formelZerlegen(formel);
  const ohneFaktor = welches === 'alle'
    ? Object.values(atome).reduce((a, b) => a + b, 0)
    : (atome[welches] || 0);
  return { gesamt: faktor * ohneFaktor, ohneFaktor, faktor };
}

let bekannteSymbole = new Set(['H', 'O', 'C', 'N', 'Cl', 'S', 'Na', 'Mg', 'Al', 'Zn', 'Pb', 'Cu', 'Fe', 'Ag', 'Au', 'Co', 'K', 'Ca']);
export function symboleSetzen(liste) { bekannteSymbole = new Set(liste); }

function istFormel(wort) {
  if (!/[A-Za-z]\d/.test(wort)) return false;
  const teile = wort.match(/[A-Z][a-z]?\d*/g);
  if (!teile || teile.join('') !== wort) return false;
  return teile.every((t) => bekannteSymbole.has(t.replace(/\d+/, '')));
}

// Text mit Formeln -> Knoten, Ziffern in Formeln werden tiefgestellt.
export function formelKnoten(text) {
  const frag = document.createDocumentFragment();
  const teile = String(text).split(/([A-Z][A-Za-z0-9]*\d[A-Za-z0-9]*)/);
  for (const teil of teile) {
    if (teil && istFormel(teil)) {
      for (const stueck of teil.split(/(\d+)/)) {
        if (!stueck) continue;
        if (/^\d+$/.test(stueck)) frag.append(el('sub', {}, stueck));
        else frag.append(stueck);
      }
    } else if (teil) {
      frag.append(teil);
    }
  }
  return frag;
}

// Für Rückgaben als reiner Text (z. B. Kopieren): H2O -> H₂O
const TIEF = '₀₁₂₃₄₅₆₇₈₉';
export function formelZeichen(text) {
  return String(text).replace(/([A-Z][A-Za-z0-9]*\d[A-Za-z0-9]*)/g, (w) =>
    istFormel(w) ? w.replace(/\d/g, (z) => TIEF[Number(z)]) : w);
}

// Formel/Symbol buchstabieren: "Na" -> "N klein a", "CO" -> "C O", "H2O" -> "H 2 O".
// Ziffern in einer Formel sind die kleine Zahl: "Al2O3" -> "A klein l, kleine 2, O, kleine 3".
export function buchstabieren(wort) {
  return wort.match(/\d+|[A-Za-zÄÖÜäöü]/g)
    .map((z) => (/^\d+$/.test(z) ? `kleine ${z},` : /[a-zäöü]/.test(z) ? `klein ${z}` : z))
    .join(' ')
    .replace(/,$/, '');
}

function istSymbolFolge(wort) {
  const teile = wort.match(/[A-Z][a-z]?\d*/g);
  return Boolean(teile && teile.join('') === wort && teile.every((t) => bekannteSymbole.has(t.replace(/\d+/, ''))));
}

// Für die Sprachausgabe: Formeln und Symbole werden buchstabiert, "2 H2O" -> "2 mal H 2 O".
export function vorlesbar(text) {
  return String(text)
    // Die Zahl vor einer Formel heißt in der App "große Zahl" (ohne "mal", das wäre schon die Deutung).
    .replace(/\b(\d+) (?=([A-Z][A-Za-z0-9]*)(?![-\w]))/g, (m, zahl, wort) => (istSymbolFolge(wort) && /[a-z\d]|^[A-Z]{1,3}$/.test(wort) ? `große ${zahl}, ` : m))
    .replace(/\b[A-Z][A-Za-z0-9]*\b/g, (w) => {
      if (/\d/.test(w) && istFormel(w)) return buchstabieren(w);
      if (w.length <= 4 && istSymbolFolge(w) && (w.length > 1 || bekannteSymbole.has(w))) return buchstabieren(w);
      if (/^[A-Z]{2,3}$/.test(w)) return buchstabieren(w);
      return w;
    })
    .replace(/→/g, ' reagieren zu ')
    .replace(/\s\+\s/g, ' und ')
    .replace(/[★✋↕🔢✏️❓🔥✓✗💡⏳]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
