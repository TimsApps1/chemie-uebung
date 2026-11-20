// Logik der Steckbausteine (Bereich 1): Steine mit Noppen (= Wertigkeit), Verbindungen, Prüfung.
// Keine Grafik hier – geprüft wird nur über Zahlen, nie über die 3D-Geometrie.

export const MAX_STEINE = 12;
export const MAX_BINDUNG = 3;

// Reihenfolge der Symbole in der Formel: Metalle zuerst, dann C, N, H, S, Cl, O.
const REIHENFOLGE = ['Na', 'Mg', 'Al', 'Zn', 'Pb', 'Cu', 'Fe', 'Ag', 'C', 'N', 'H', 'S', 'Cl', 'O'];
const ROEMISCH = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

// "Fe(III)" -> { symbol: 'Fe', wertigkeit: 3 }, "O" -> { symbol: 'O', wertigkeit: aus der Elementliste }
export function steinArt(eintrag, elemente) {
  const m = String(eintrag).match(/^([A-Z][a-z]?)(?:\s*\((I{1,3}|IV)\))?$/);
  if (!m) return null;
  const el = elemente.find((e) => e.symbol === m[1]);
  if (!el || !el.wertigkeit?.length) return null;
  const roemisch = { I: 1, II: 2, III: 3, IV: 4 };
  const w = m[2] ? roemisch[m[2]] : el.wertigkeit[0];
  if (!el.wertigkeit.includes(w)) return null;
  return {
    art: eintrag, symbol: el.symbol, name: el.name, metall: el.metall, wertigkeit: w,
    beschriftung: el.wertigkeit.length > 1 ? `${el.symbol}(${ROEMISCH[w]})` : el.symbol
  };
}

// ---------- Modell ----------
// { steine: [{ id, symbol, wertigkeit, metall, art }], bindungen: [{ a, b, anzahl }] }

export function leeresModell() {
  return { steine: [], bindungen: [], naechsteId: 1 };
}

export function kopie(m) {
  return JSON.parse(JSON.stringify(m));
}

export const stein = (m, id) => m.steine.find((s) => s.id === id);

export function belegt(m, id) {
  return m.bindungen.filter((b) => b.a === id || b.b === id).reduce((s, b) => s + b.anzahl, 0);
}

export function frei(m, id) {
  const s = stein(m, id);
  return s ? s.wertigkeit - belegt(m, id) : 0;
}

export const alleFrei = (m) => m.steine.reduce((s, x) => s + frei(m, x.id), 0);

function bindung(m, a, b) {
  return m.bindungen.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
}

// Darf zwischen zwei Steinen (noch) eine Verbindung entstehen? Liefert null oder einen Grund.
export function verbindungVerboten(m, a, b) {
  const sa = stein(m, a);
  const sb = stein(m, b);
  if (!sa || !sb) return 'Diesen Stein gibt es nicht.';
  if (a === b) return 'Ein Stein kann nicht mit sich selbst verbunden werden.';
  if (sa.metall && sb.metall) return 'Metall darf nur an Nichtmetall: Zwei Metalle passen hier nicht zusammen.';
  if (sa.symbol === sb.symbol) return `Zwei ${sa.symbol}-Steine verbinden wir in diesem Modell nicht miteinander.`;
  if (frei(m, a) < 1 || frei(m, b) < 1) return 'Dafür ist keine Noppe mehr frei.';
  const vorhanden = bindung(m, a, b);
  if (vorhanden && vorhanden.anzahl >= MAX_BINDUNG) return 'Mehr als drei Bindungen zwischen zwei Steinen gibt es nicht.';
  // Schwefel nur mit Metallen oder Wasserstoff, Stickstoff nur mit Wasserstoff (NH3).
  for (const [x, y] of [[sa, sb], [sb, sa]]) {
    if (x.symbol === 'S' && !(y.metall || y.symbol === 'H')) return 'Schwefel steckt hier nur mit Metallen oder Wasserstoff zusammen.';
    if (x.symbol === 'N' && y.symbol !== 'H') return 'Stickstoff bauen wir hier nur mit Wasserstoff (NH3).';
  }
  return null;
}

// Ersten Stein auf die leere Fläche legen.
export function ersterStein(m, art) {
  if (m.steine.length) return { ok: false, grund: 'Es liegt schon ein Stein. Tippe auf eine freie Noppe.' };
  const s = { ...art, id: m.naechsteId++ };
  m.steine.push(s);
  return { ok: true, id: s.id };
}

// Neuen Stein an eine freie Noppe des Steins "an" stecken (eine Verbindung).
export function anstecken(m, art, an) {
  if (m.steine.length >= MAX_STEINE) return { ok: false, grund: `Mehr als ${MAX_STEINE} Steine passen nicht in ein Modell.` };
  const ziel = stein(m, an);
  if (!ziel) return { ok: false, grund: 'Tippe auf eine freie Noppe.' };
  const neu = { ...art, id: m.naechsteId };
  m.steine.push(neu);
  const grund = verbindungVerboten(m, an, neu.id);
  if (grund) { m.steine.pop(); return { ok: false, grund }; }
  m.naechsteId++;
  m.bindungen.push({ a: an, b: neu.id, anzahl: 1 });
  return { ok: true, id: neu.id };
}

// Zwei liegende Steine (noch einmal) verbinden: Doppel- und Dreifachverbindungen.
export function verbinden(m, a, b) {
  const grund = verbindungVerboten(m, a, b);
  if (grund) return { ok: false, grund };
  const vorhanden = bindung(m, a, b);
  if (vorhanden) vorhanden.anzahl += 1;
  else m.bindungen.push({ a, b, anzahl: 1 });
  return { ok: true };
}

// Stein lösen (mit allen seinen Bindungen). Der vorgegebene Startstein bleibt liegen.
export function loesen(m, id) {
  const s = stein(m, id);
  if (!s) return { ok: false, grund: 'Tippe zuerst auf den Stein, den du lösen willst.' };
  if (s.fest) return { ok: false, grund: `Der Startstein ${s.beschriftung} bleibt liegen.` };
  m.steine = m.steine.filter((s) => s.id !== id);
  m.bindungen = m.bindungen.filter((b) => b.a !== id && b.b !== id);
  return { ok: true };
}

// Eine Verbindung zwischen zwei Steinen lösen (z. B. Doppel- zu Einfachverbindung).
export function verbindungLoesen(m, a, b) {
  const x = bindung(m, a, b);
  if (!x) return { ok: false };
  x.anzahl -= 1;
  if (x.anzahl <= 0) m.bindungen = m.bindungen.filter((y) => y !== x);
  return { ok: true };
}

// ---------- Auswertung ----------

export function zaehlen(m) {
  const z = {};
  for (const s of m.steine) z[s.symbol] = (z[s.symbol] || 0) + 1;
  return z;
}

export function formelVon(zaehlung) {
  const symbole = Object.keys(zaehlung).sort((a, b) => REIHENFOLGE.indexOf(a) - REIHENFOLGE.indexOf(b));
  return symbole.map((s) => s + (zaehlung[s] > 1 ? zaehlung[s] : '')).join('');
}

export function formelZaehlung(formel) {
  const z = {};
  for (const [, sym, n] of String(formel).matchAll(/([A-Z][a-z]?)(\d*)/g)) z[sym] = (z[sym] || 0) + (n ? Number(n) : 1);
  return z;
}

export function zusammenhaengend(m) {
  if (!m.steine.length) return false;
  const gesehen = new Set([m.steine[0].id]);
  const stapel = [m.steine[0].id];
  while (stapel.length) {
    const id = stapel.pop();
    for (const b of m.bindungen) {
      const n = b.a === id ? b.b : b.b === id ? b.a : null;
      if (n && !gesehen.has(n)) { gesehen.add(n); stapel.push(n); }
    }
  }
  return gesehen.size === m.steine.length;
}

const gleicheZaehlung = (x, y) => {
  const k = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...k].every((s) => (x[s] || 0) === (y[s] || 0));
};

// Ergebnis für die Prüfung einer Bau-Aufgabe.
export function bauErgebnis(m, zielFormel) {
  const zaehlung = zaehlen(m);
  const offen = alleFrei(m);
  const ziel = formelZaehlung(zielFormel);
  const voll = m.steine.length > 0 && offen === 0;
  const passt = gleicheZaehlung(zaehlung, ziel);
  return {
    geloest: voll && passt && zusammenhaengend(m),
    voll, passt, offen, zaehlung, formel: m.steine.length ? formelVon(zaehlung) : '',
    zusammen: zusammenhaengend(m),
    zuViel: Object.keys(zaehlung).filter((s) => zaehlung[s] > (ziel[s] || 0)),
    zuWenig: Object.keys(ziel).filter((s) => (zaehlung[s] || 0) < ziel[s])
  };
}

// Hinweis nach einem Fehlversuch (ohne die Lösung zu verraten).
// steinarten = alle Steine der Aufgabe (Start + Leiste), name = Aufgabentext (für die römische Zahl),
// denkanstoss = Hinweis aus der Aufgabe; er ergänzt den allgemeinen Zustand „Noch N Noppen frei“.
export function bauHinweis(m, zielFormel, elemente, { steinarten = [], name = '', denkanstoss = '' } = {}) {
  const e = bauErgebnis(m, zielFormel);
  const beschr = (sym) => m.steine.find((x) => x.symbol === sym)?.beschriftung || sym;
  const noppen = (sym) => {
    const s = m.steine.find((x) => x.symbol === sym);
    return s ? s.wertigkeit : elemente.find((x) => x.symbol === sym)?.wertigkeit?.[0];
  };
  if (!m.steine.length) return 'Tippe unten auf einen Stein. Er kommt in die Mitte.';
  // Falscher Stein bei zwei Wertigkeiten (z. B. Cu(II) statt Cu(I))?
  if (steinarten.length) {
    const loesung = loesungsModell(zielFormel, steinarten, elemente);
    const falsch = loesung && m.steine.find((s) => loesung.steine.some((x) => x.symbol === s.symbol && x.wertigkeit !== s.wertigkeit));
    if (falsch) {
      return /\((I{1,3}|IV)\)/.test(name)
        ? `Schau auf die römische Zahl im Namen. Sie sagt, wie viele Noppen der ${falsch.symbol}-Stein hat. Dein Stein ist ${falsch.beschriftung}.`
        : `Mit dem Stein ${falsch.beschriftung} geht es nicht auf. Probier den anderen ${falsch.symbol}-Stein.`;
    }
  }
  if (e.zuViel.length && e.offen > 0) {
    const zuvielSym = e.zuViel[0];
    const andere = Object.keys(formelZaehlung(zielFormel)).find((s) => s !== zuvielSym);
    if (andere) {
      return `Zähl die Noppen: ${beschr(andere)} hat ${noppen(andere)}, ${beschr(zuvielSym)} hat ${noppen(zuvielSym)}. ` +
        (noppen(andere) === noppen(zuvielSym) ? `Ein ${beschr(zuvielSym)} reicht. Zwei Noppen können zum selben Partner gehen.` : `Wie viele ${beschr(zuvielSym)} brauchst du wirklich?`);
    }
  }
  if (e.offen > 0) {
    return `Noch ${e.offen === 1 ? '1 Noppe' : `${e.offen} Noppen`} frei. ${denkanstoss || 'Jede Noppe braucht einen Partner.'}`;
  }
  if (!e.zusammen) return 'Alle Steine müssen zu einem einzigen Modell zusammenhängen.';
  if (!e.passt) return `Alle Noppen sind belegt, aber das ist ${e.formel}. Schau, welche Steine du brauchst.`;
  return null;
}

// Was soll das Kind als Nächstes tun? (Statuszeile der Baustelle)
export function naechsterSchritt(m) {
  if (!m.steine.length) return 'Tippe unten auf einen Stein. Er kommt in die Mitte.';
  const offen = m.steine.filter((s) => frei(m, s.id) > 0);
  if (!offen.length) return 'Alle Noppen sind belegt.';
  for (const a of offen) {
    const b = offen.find((x) => x.id !== a.id && !verbindungVerboten(m, a.id, x.id));
    if (b) return `${a.beschriftung} und ${b.beschriftung} haben noch freie Noppen. Verbinden: Tippe ${a.beschriftung} an, dann ${b.beschriftung}. Oder nimm unten einen neuen Stein.`;
  }
  return 'Nimm unten einen Stein und tippe dann auf eine freie (gelbe) Noppe.';
}

// ---------- Automatisch bauen (für "Welche Formel ist das?" und Lösungen) ----------
// Verteilt die Verbindungen so, dass alle Noppen belegt sind und alles zusammenhängt.

function zufall(saat) {
  let x = (saat * 2654435761) % 4294967296;
  return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
}

export function automatischBauen(arten) {
  const n = arten.length;
  if (!n || n > MAX_STEINE) return null;
  const summe = arten.reduce((s, a) => s + a.wertigkeit, 0);
  if (summe % 2) return null;
  for (let versuch = 0; versuch < 400; versuch++) {
    const rnd = zufall(versuch + 1);
    const m = leeresModell();
    arten.forEach((a) => m.steine.push({ ...a, id: m.naechsteId++ }));
    // Erst einen Baum (zusammenhängend), dann die übrigen Noppen auffüllen.
    const ids = m.steine.map((s) => s.id).sort(() => rnd() - 0.5);
    const imBaum = [ids[0]];
    let ok = true;
    for (const id of ids.slice(1)) {
      const kandidaten = imBaum.filter((x) => !verbindungVerboten(m, x, id)).sort((x, y) => frei(m, y) - frei(m, x) || rnd() - 0.5);
      if (!kandidaten.length) { ok = false; break; }
      verbinden(m, kandidaten[0], id);
      imBaum.push(id);
    }
    if (!ok) continue;
    let fortschritt = true;
    while (alleFrei(m) > 0 && fortschritt) {
      fortschritt = false;
      const offen = m.steine.filter((s) => frei(m, s.id) > 0).sort((x, y) => frei(m, y.id) - frei(m, x.id) || rnd() - 0.5);
      for (const x of offen) {
        const partner = offen.filter((y) => y.id !== x.id && !verbindungVerboten(m, x.id, y.id))
          .sort((p, q) => frei(m, q.id) - frei(m, p.id) || rnd() - 0.5)[0];
        if (partner) { verbinden(m, x.id, partner.id); fortschritt = true; break; }
      }
    }
    if (alleFrei(m) === 0 && zusammenhaengend(m)) return m;
  }
  return null;
}

// Formel + Steinarten -> fertiges Modell (z. B. "Fe2O3" mit "Fe(III)").
export function modellAusFormel(formel, steinarten, elemente) {
  const z = formelZaehlung(formel);
  const arten = [];
  for (const [sym, anzahl] of Object.entries(z)) {
    const eintrag = steinarten.find((a) => String(a).replace(/\s*\(.*\)/, '') === sym) || sym;
    const art = steinArt(eintrag, elemente);
    if (!art) return null;
    for (let i = 0; i < anzahl; i++) arten.push(art);
  }
  return automatischBauen(arten);
}

// Wie modellAusFormel, probiert aber bei Eisen/Kupfer alle angebotenen Steine (Fe(II)/Fe(III) …).
export function loesungsModell(formel, steinarten, elemente) {
  const z = formelZaehlung(formel);
  const symbole = Object.keys(z);
  const kandidaten = symbole.map((sym) => {
    const passend = steinarten.filter((a) => String(a).replace(/\s*\(.*\)/, '') === sym);
    return passend.length ? passend : [sym];
  });
  const kombinationen = kandidaten.reduce((alle, liste) => alle.flatMap((k) => liste.map((x) => [...k, x])), [[]]);
  for (const k of kombinationen) {
    const m = modellAusFormel(formel, k, elemente);
    if (m) return m;
  }
  return null;
}
