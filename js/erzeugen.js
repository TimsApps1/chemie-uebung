// Zusätzliche Aufgaben, die die App selbst aus den Daten erzeugt (mehr Abwechslung).
// Sie entstehen aus reihe.json und elemente.json, sind also immer zur Reihe passend.
// Abschalten: in daten/app.json "aufgaben_erzeugen": false
import { atomeZaehlen } from './hilfen.js';

const LATEIN = {
  H: 'Hydrogenium', O: 'Oxygenium', C: 'Carboneum', N: 'Nitrogenium', S: 'Sulfur',
  Fe: 'Ferrum', Cu: 'Cuprum', Ag: 'Argentum', Au: 'Aurum', Pb: 'Plumbum', Hg: 'Hydrargyrum',
  Sn: 'Stannum', Na: 'Natrium', K: 'Kalium'
};
// Gold und Silber haben keine Oxide in der Reihe; als Stoff wären sie zu einfache "klappt nicht"-Fälle.
const NICHT_ALS_STOFF = ['Gold', 'Silber'];
const HAEUFIG = ['H', 'O', 'C', 'N', 'S', 'Cl', 'Na', 'Mg', 'Al', 'Fe', 'Cu', 'Zn', 'K', 'Ca'];
const SELTENER = ['Pb', 'Ag', 'Au', 'Co', 'Si', 'Hg', 'Sn', 'He', 'Ne', 'P', 'F', 'I'];

// Kleiner fester Zufall, damit die erzeugten Aufgaben bei jedem Start gleich sind.
function zufall(saat) {
  let x = saat * 9301 + 49297;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

function eindeutig(liste) {
  return [...new Set(liste)];
}

// ---------- Bereich 3: "Klappt es?" für alle erlaubten Paare ----------

function klapptAufgaben(reihe, vorhanden) {
  const stoffe = reihe.stoffe;
  const verboten = new Set((reihe.nicht_abfragen || []).map(([o, s]) => `${o}|${s}`));
  const schonDa = new Set(vorhanden.filter((a) => a.typ === 'klappt').map((a) => `${a.oxid}|${a.stoff}`));
  const liste = [];
  stoffe.forEach((oxidStoff, i) => {
    // Kohlenstoffdioxid lassen wir weg (Grenzfälle wie Zink + Kohlenstoffdioxid).
    if (!oxidStoff.oxid || oxidStoff.name === 'Kohlenstoff') return;
    stoffe.forEach((stoff, j) => {
      if (i === j || NICHT_ALS_STOFF.includes(stoff.name)) return;
      const schluessel = `${oxidStoff.oxid}|${stoff.name}`;
      if (verboten.has(schluessel) || schonDa.has(schluessel)) return;
      const abstand = Math.abs(i - j);
      const niveau = abstand >= 4 ? 1 : abstand >= 2 ? 2 : 3;
      const klappt = j > i;
      const s = stoff.name;
      const e = oxidStoff.name;
      const o = oxidStoff.oxid;
      const istC = s === 'Kohlenstoff';
      const staerker = istC ? `Kohlenstoff hält Sauerstoff stärker fest als ${e}` : `${s} ist unedler als ${e} und hält Sauerstoff stärker fest`;
      const schwaecher = istC ? `Kohlenstoff hält Sauerstoff schwächer fest als ${e}` : `${s} ist edler als ${e} und hält Sauerstoff schwächer fest`;
      const a = {
        id: `gen-k-${o}-${s}`.toLowerCase(), niveau, typ: 'klappt', symbol: '🔥', kann: 'klappt', generiert: true,
        frage: 'Klappt es beim Erhitzen?', oxid: o, stoff: s,
        leicht: klappt && abstand >= 5 ? true : undefined,
        denkanstoss: `Such ${e} und ${s} in der Reihe. Wer hält Sauerstoff stärker fest?`,
        erklaerung: klappt
          ? `${staerker}. Darum nimmt ${istC ? 'er' : s} dem ${o} den Sauerstoff weg.`
          : `${schwaecher}. Darum kann ${istC ? 'er' : s} dem ${o} den Sauerstoff nicht wegnehmen.`
      };
      if (niveau === 3) {
        const richtig = klappt ? `${s} hält Sauerstoff stärker fest als ${e}.` : `${s} hält Sauerstoff schwächer fest als ${e}.`;
        a.warum = {
          frage: klappt ? 'Warum klappt es?' : 'Warum klappt es nicht?',
          antworten: [richtig,
            klappt ? `${e} hält Sauerstoff stärker fest als ${s}.` : `${e} hält Sauerstoff schwächer fest als ${s}.`,
            'Beim Erhitzen reagieren alle Stoffe miteinander.'],
          richtig
        };
      }
      liste.push(a);
    });
  });
  // Pro Niveau gleich viele "klappt" und "klappt nicht", damit Raten nicht hilft.
  const ausgeglichen = [];
  for (const n of [1, 2, 3]) {
    const ja = liste.filter((a) => a.niveau === n && !/nicht wegnehmen/.test(a.erklaerung));
    const nein = liste.filter((a) => a.niveau === n && /nicht wegnehmen/.test(a.erklaerung));
    const k = Math.min(ja.length, nein.length);
    ausgeglichen.push(...ja.slice(0, k), ...nein.slice(0, k));
  }
  return ausgeglichen;
}

// ---------- Bereich 3: Wortgleichungen und "Wer wird reduziert?" ----------
// Nur für Paare, bei denen die Reaktion laut Reihe klappt. Abstand 1–3 (nicht trivial).

function gleichungsAufgaben(reihe, vorhanden) {
  const stoffe = reihe.stoffe;
  const verboten = new Set((reihe.nicht_abfragen || []).map(([o, s]) => `${o}|${s}`));
  const schonDa = new Set(vorhanden.filter((a) => a.links).map((a) => a.links.join('|')));
  const liste = [];
  stoffe.forEach((oxidStoff, i) => {
    if (!oxidStoff.oxid || oxidStoff.name === 'Kohlenstoff') return;
    stoffe.forEach((stoff, j) => {
      const abstand = j - i;
      if (abstand < 1 || abstand > 3 || !stoff.oxid) return;
      const o = oxidStoff.oxid; const s = stoff.name; const e = oxidStoff.name; const so = stoff.oxid;
      if (verboten.has(`${o}|${s}`) || schonDa.has(`${o}|${s}`)) return;
      const niveau = abstand === 1 ? 3 : 2;
      const id = `${o}-${s}`.toLowerCase();
      liste.push({
        id: `gen-w-${id}`, niveau, typ: 'wortgleichung', symbol: '✏️', kann: 'wortgleichung', generiert: true,
        frage: 'Ergänze die Wortgleichung.', links: [o, s], rechts: ['?', '?'], richtig: [e, so],
        auswahl: [e, so, o, s, 'Sauerstoff'],
        denkanstoss: `Der Sauerstoff wandert vom ${o} zum ${s}.`,
        erklaerung: `${s} nimmt dem ${o} den Sauerstoff weg. So entstehen ${e} und ${so}.`
      });
      liste.push({
        id: `gen-r-${id}`, niveau, typ: 'antippen', symbol: '✋', kann: 'redox', generiert: true,
        frage: 'Welcher Stoff wird reduziert?', links: [o, s], rechts: [e, so], richtig: o,
        fehler: {
          [e]: `${e} hat keinen Sauerstoff. Wer gibt Sauerstoff ab?`,
          [s]: `${s} nimmt Sauerstoff auf. Das heißt oxidiert.`
        },
        denkanstoss: 'Reduziert wird der Stoff, der Sauerstoff abgibt.',
        erklaerung: `Das ${o} gibt seinen Sauerstoff ab. Es wird reduziert, und ${e} entsteht.`
      });
    });
  });
  return liste;
}

// ---------- Bereich 4: Symbole und Namen ----------

function symbolAufgaben(elemente, vorhanden) {
  const nachSymbol = Object.fromEntries(elemente.map((e) => [e.symbol, e]));
  // Was es schon als selbst geschriebene Aufgabe gibt, wird nicht doppelt erzeugt.
  const schonDa = new Set(vorhanden.filter((a) => a.typ === 'auswahl').map((a) => a.richtig));
  const liste = [];
  const machen = (symbole, niveau) => symbole.filter((s) => nachSymbol[s]).forEach((sym, nr) => {
    const e = nachSymbol[sym];
    const rnd = zufall(nr + niveau * 50);
    const andere = elemente.filter((x) => x.symbol !== sym);
    const latein = LATEIN[sym] && LATEIN[sym] !== e.name ? ` Das kommt vom lateinischen Namen ${LATEIN[sym]}.` : '';
    // Name -> Symbol
    const falsche = eindeutig([
      sym.length === 2 ? sym.toUpperCase() : null,
      sym.length === 2 ? sym[0] : null,
      sym.length === 1 ? sym.toLowerCase() : null,
      e.name.slice(0, 2) !== sym ? e.name.slice(0, 2) : null,
      ...andere.filter((x) => x.symbol[0] === sym[0]).map((x) => x.symbol),
      andere[Math.floor(rnd() * andere.length)].symbol
    ].filter((x) => x && x !== sym && !(sym.length === 1 && x === sym))).slice(0, 3);
    if (falsche.length >= 2 && !schonDa.has(sym)) {
      liste.push({
        id: `gen-s-${sym}-${niveau}`.toLowerCase(), niveau, typ: 'auswahl', symbol: '❓', kann: 'symbole', generiert: true,
        leicht: niveau === 1 && ['H', 'O', 'C'].includes(sym) ? true : undefined,
        frage: `Welches Symbol hat ${e.name}?`, antworten: [sym, ...falsche], richtig: sym,
        denkanstoss: sym.length === 2 ? 'Ein Symbol: erster Buchstabe groß, zweiter Buchstabe klein.'
          : latein ? 'Manche Symbole kommen aus dem Lateinischen.' : 'Manche Symbole haben nur einen Buchstaben.',
        erklaerung: `${e.name} hat das Symbol ${sym}.${latein}`
      });
    }
    // Symbol -> Name
    // Ablenker: Namen mit gleichem Anfang wie der deutsche Name (nicht wie das Symbol, sonst wäre es eine Falle).
    const gleicherAnfang = andere.filter((x) => x.name[0] === e.name[0]).map((x) => x.name);
    const namen = eindeutig([...gleicherAnfang, ...andere.map((x) => x.name)]).filter((n) => n !== e.name);
    const start = Math.floor(rnd() * Math.max(1, namen.length - 3));
    const falscheNamen = eindeutig([...gleicherAnfang.slice(0, 2), ...namen.slice(start, start + 3)]).slice(0, 3);
    if (schonDa.has(e.name)) return;
    liste.push({
      id: `gen-n-${sym}-${niveau}`.toLowerCase(), niveau, typ: 'auswahl', symbol: '❓', kann: 'symbole', generiert: true,
      frage: `Für welches Element steht das Symbol ${sym}?`, antworten: [e.name, ...falscheNamen], richtig: e.name,
      denkanstoss: e.name[0] === sym[0] ? 'Denk an den Anfang des Namens.' : 'Manche Symbole kommen aus dem Lateinischen.',
      erklaerung: `${sym} ist das Symbol für ${e.name}.${latein}`
    });
  });
  machen(HAEUFIG, 1);
  machen(SELTENER, 2);
  return liste;
}

// ---------- Bereich 4 ★★★: Zählen mit Zahl davor ----------

const FORMELN = ['H2O', 'CO2', 'NH3', 'CH4', 'MgO', 'Al2O3', 'Fe2O3', 'CuO', 'NaCl', 'O2', 'H2', 'ZnS', 'MgCl2', 'Na2O'];

function zahlAufgaben(vorhanden) {
  const schonDa = new Set(vorhanden.filter((a) => a.typ === 'zahl').map((a) => `${a.formel}|${a.zaehle}`));
  const liste = [];
  FORMELN.forEach((f, i) => {
    const faktor = 2 + (i % 3);
    const formel = `${faktor} ${f}`;
    const symbole = [...new Set(f.match(/[A-Z][a-z]?/g))];
    const zaehle = i % 2 === 0 ? 'alle' : symbole[i % symbole.length];
    if (schonDa.has(`${formel}|${zaehle}`)) return;
    const { gesamt, ohneFaktor } = atomeZaehlen(formel, zaehle);
    const was = zaehle === 'alle' ? 'Atome insgesamt' : `${zaehle}-${ohneFaktor === 1 ? 'Atom' : 'Atome'}`;
    liste.push({
      id: `gen-z-${faktor}-${f}-${zaehle}`.toLowerCase(), niveau: 3, typ: 'zahl', symbol: '🔢', kann: 'zahl_davor', generiert: true,
      frage: zaehle === 'alle' ? 'Wie viele Atome sind es insgesamt?' : `Wie viele ${zaehle}-Atome sind es?`,
      formel, zaehle,
      denkanstoss: 'Die große Zahl gilt für die ganze Formel.',
      erklaerung: `Die Formel ${f} zeigt ${ohneFaktor} ${was}. Mal ${faktor} sind das ${gesamt}.`
    });
  });
  return liste;
}

// ---------- Bereich 3: Sortieren mit jedes Mal anderen Karten ----------

function sortierAufgaben() {
  const grund = { typ: 'sortieren', symbol: '↕', kann: 'reihe', generiert: true,
    frage: 'Sortiere von edel (oben) nach unedel (unten).',
    denkanstoss: 'Edle Metalle bleiben lange blank. Unedle Metalle reagieren leicht mit Sauerstoff.',
    erklaerung: 'Die Reihe von edel nach unedel: Gold, Silber, Kupfer, Blei, Eisen, Kohlenstoff, Zink, Aluminium, Magnesium.' };
  return [
    { ...grund, id: 'gen-sort-1', niveau: 1, karten_zufall: 4 },
    { ...grund, id: 'gen-sort-2', niveau: 2, karten_zufall: 6, mit_kohlenstoff: true },
    { ...grund, id: 'gen-sort-3', niveau: 3, karten_zufall: 7, mit_kohlenstoff: true }
  ];
}

// ★ und ★★: Zählen ohne Zahl davor.
const FORMELN_EINFACH = { 1: ['H2O', 'CO2', 'O2', 'MgO', 'NaCl', 'CH4', 'H2S'], 2: ['Al2O3', 'Fe2O3', 'NH3', 'MgCl2', 'Na2O', 'CuO', 'ZnS', 'AlCl3'] };

function zahlAufgabenEinfach(vorhanden) {
  const schonDa = new Set(vorhanden.filter((a) => a.typ === 'zahl').map((a) => `${a.formel}|${a.zaehle}`));
  const liste = [];
  for (const [niveau, formeln] of Object.entries(FORMELN_EINFACH)) {
    formeln.forEach((f, i) => {
      const symbole = [...new Set(f.match(/[A-Z][a-z]?/g))];
      const zaehle = i % 2 === 0 ? 'alle' : symbole[i % symbole.length];
      if (schonDa.has(`${f}|${zaehle}`)) return;
      const { gesamt } = atomeZaehlen(f, zaehle);
      liste.push({
        id: `gen-z1-${f}-${zaehle}`.toLowerCase(), niveau: Number(niveau), typ: 'zahl', symbol: '🔢', kann: 'zaehlen', generiert: true,
        frage: zaehle === 'alle' ? 'Wie viele Atome sind es insgesamt?' : `Wie viele ${zaehle}-Atome sind es?`,
        formel: f, zaehle,
        denkanstoss: 'Die kleine Zahl gehört zum Symbol direkt davor. Steht keine kleine Zahl da, zählt das Symbol einmal.',
        erklaerung: zaehle === 'alle' ? `In ${f} stecken zusammen ${gesamt} Atome.` : `In ${f} stecken ${gesamt} ${zaehle}-${gesamt === 1 ? 'Atom' : 'Atome'}.`
      });
    });
  }
  return liste;
}

export function aufgabenErzeugen(d) {
  if (d.app.aufgaben_erzeugen === false) return;
  if (d.aufgaben.B3 && d.reihe) d.aufgaben.B3.push(...klapptAufgaben(d.reihe, d.aufgaben.B3), ...gleichungsAufgaben(d.reihe, d.aufgaben.B3), ...sortierAufgaben());
  if (d.aufgaben.B4 && d.elemente.length) d.aufgaben.B4.push(...symbolAufgaben(d.elemente, d.aufgaben.B4), ...zahlAufgaben(d.aufgaben.B4), ...zahlAufgabenEinfach(d.aufgaben.B4));
}
