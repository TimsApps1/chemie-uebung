// Logik für Bereich 2: Reaktionsgleichungen mit der Waage ausgleichen.
// Keine Grafik hier. Eine Aufgabe hat „edukte“ und „produkte“ (je { formel, name }),
// die Zahlen davor stehen in einer Liste: erst alle Edukte, dann alle Produkte.
import { formelZaehlung } from './bausteine-logik.js';

export const MAX_ZAHL = 6;       // höchstens 6 Teilchen eines Stoffes
export const MAX_STEINE = 40;    // höchstens 40 Steine auf dem Bildschirm

export const alleStoffe = (a) => [...a.edukte, ...a.produkte];
export const startZahlen = (a) => (a.start ? [...a.start] : alleStoffe(a).map(() => 1));

const ggT2 = (x, y) => (y ? ggT2(y, x % y) : x);
export const ggT = (zahlen) => zahlen.reduce((g, z) => ggT2(g, z), 0);

export function atomeIm(formel) {
  return Object.values(formelZaehlung(formel)).reduce((s, n) => s + n, 0);
}

export function steineGesamt(a, zahlen) {
  return alleStoffe(a).reduce((s, x, i) => s + atomeIm(x.formel) * zahlen[i], 0);
}

function seite(stoffe, zahlen) {
  const z = {};
  stoffe.forEach((s, i) => {
    for (const [sym, n] of Object.entries(formelZaehlung(s.formel))) z[sym] = (z[sym] || 0) + n * zahlen[i];
  });
  return z;
}

// Was zeigt die Waage? Zeilen pro Element in der Reihenfolge des Auftretens.
export function waage(a, zahlen) {
  const links = seite(a.edukte, zahlen.slice(0, a.edukte.length));
  const rechts = seite(a.produkte, zahlen.slice(a.edukte.length));
  const symbole = [];
  for (const s of alleStoffe(a)) for (const sym of Object.keys(formelZaehlung(s.formel))) if (!symbole.includes(sym)) symbole.push(sym);
  const zeilen = symbole.map((symbol) => ({ symbol, links: links[symbol] || 0, rechts: rechts[symbol] || 0, gleich: (links[symbol] || 0) === (rechts[symbol] || 0) }));
  const ausgeglichen = zeilen.every((z) => z.gleich);
  const kleinste = ggT(zahlen) === 1;
  const summe = (o) => Object.values(o).reduce((s, n) => s + n, 0);
  return { zeilen, ausgeglichen, kleinste, geloest: ausgeglichen && kleinste, kipp: Math.sign(summe(links) - summe(rechts)) };
}

// Gleichung als Text: "2 Mg + O2 → 2 MgO"
export function gleichungText(a, zahlen) {
  const teil = (stoffe, start) => stoffe.map((s, i) => `${zahlen[start + i] > 1 ? `${zahlen[start + i]} ` : ''}${s.formel}`).join(' + ');
  return `${teil(a.edukte, 0)} → ${teil(a.produkte, a.edukte.length)}`;
}

// Hinweis nach einem Fehlversuch (verrät die Lösung nicht).
export function ausgleichHinweis(a, zahlen) {
  const w = waage(a, zahlen);
  if (w.ausgeglichen && !w.kleinste) {
    return `Die Waage steht gerade, aber es geht mit kleineren Zahlen. Teile alle Zahlen durch ${ggT(zahlen)}.`;
  }
  const z = w.zeilen.find((x) => !x.gleich);
  if (!z) return null;
  const weniger = z.links < z.rechts ? 'links' : 'rechts';
  return `Zähl die ${z.symbol}-Atome: links ${z.links}, rechts ${z.rechts}. Nimm ${weniger} mit + ein ganzes Teilchen dazu, das ${z.symbol} enthält.`;
}

// ---------- Index-Falle: „Atom anhängen“ ----------
// Liefert { neu, text }: Wie sähe die Formel mit einem Atom mehr aus, und warum ist das nicht erlaubt?

function formelMitEinemMehr(formel) {
  const teile = [...String(formel).matchAll(/([A-Z][a-z]?)(\d*)/g)].map((m) => [m[1], m[2] ? Number(m[2]) : 1]);
  if (!teile.length) return formel;
  teile[teile.length - 1][1] += 1;
  return teile.map(([s, n]) => s + (n > 1 ? n : '')).join('');
}

export function falle(stoff, elemente = []) {
  if (stoff.falle?.formel) {
    return { neu: stoff.falle.formel, text: stoff.falle.text || `Dann wäre es nicht mehr ${stoff.name}, sondern ein anderer Stoff.` };
  }
  const z = formelZaehlung(stoff.formel);
  const symbole = Object.keys(z);
  const regel = 'Die kleinen Zahlen gehören zum Stoff. Ändern darfst du nur die große Zahl davor: Nimm mit + ein ganzes Teilchen dazu.';
  if (symbole.length === 1) {
    const sym = symbole[0];
    const el = elemente.find((e) => e.symbol === sym);
    if (z[sym] === 2) {
      return { neu: null, text: `${stoff.name} besteht aus Zweierteilchen: ${stoff.formel}. Ein drittes Atom gehört nicht dazu. ${regel}` };
    }
    return {
      neu: null,
      text: `${el?.metall ? 'Metalle bilden große Verbände.' : `${stoff.name} bildet einen großen Verband.`} Deshalb schreiben wir nur das Symbol ${sym}. ${regel}`
    };
  }
  const neu = formelMitEinemMehr(stoff.formel);
  return { neu, text: `Aus ${stoff.formel} würde ${neu}. Das wäre ein anderer Stoff, nicht mehr ${stoff.name}. ${regel}` };
}

// ---------- Prüfen der Daten (für daten.js) ----------

export function ausgleichenPruefen(a, elemente = []) {
  const probleme = [];
  const listeOk = (l) => Array.isArray(l) && l.length && l.every((s) => s && typeof s.formel === 'string' && typeof s.name === 'string');
  if (!listeOk(a.edukte) || !listeOk(a.produkte)) {
    probleme.push('„edukte“ und „produkte“ brauchen Stoffe wie { "formel": "MgO", "name": "Magnesiumoxid" }.');
    return probleme;
  }
  const symbole = new Set(elemente.map((e) => e.symbol));
  const unbekannt = alleStoffe(a).flatMap((s) => Object.keys(formelZaehlung(s.formel))).filter((s) => symbole.size && !symbole.has(s));
  if (unbekannt.length) probleme.push(`Unbekannte Elemente: ${[...new Set(unbekannt)].join(', ')}.`);
  const n = alleStoffe(a).length;
  if (!Array.isArray(a.loesung) || a.loesung.length !== n) probleme.push(`„loesung“ braucht ${n} Zahlen (eine pro Stoff).`);
  else {
    const w = waage(a, a.loesung);
    if (!w.ausgeglichen) probleme.push(`Die „loesung“ ${gleichungText(a, a.loesung)} ist nicht ausgeglichen.`);
    else if (!w.kleinste) probleme.push('Die „loesung“ lässt sich noch kürzen (kleinste Zahlen nehmen).');
  }
  if (a.start && (!Array.isArray(a.start) || a.start.length !== n)) probleme.push(`„start“ braucht ${n} Zahlen.`);
  if (a.pruefen && !a.start) probleme.push('Bei „pruefen“ braucht es „start“ (die Zahlen, die das Kind prüfen soll).');
  return probleme;
}
