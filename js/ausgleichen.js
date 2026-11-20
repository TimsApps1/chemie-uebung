// Bereich 2: Reaktionen mit Bausteinen ausgleichen.
// Links die Edukte, rechts die Produkte als flache Bausteine (schont alte iPads).
// Mit + und – nimmt man ein ganzes Teilchen dazu oder weg. Die Waage zählt jedes Element links und rechts.
// „Atom anhängen“ zeigt die Index-Falle: Es entstünde ein anderer Stoff. Die Änderung wird sofort zurückgenommen.
import { el, formelKnoten } from './hilfen.js';
import { baustein, fenster, vorlesenKnopf, text } from './ui.js';
import { formelZaehlung } from './bausteine-logik.js';
import {
  alleStoffe, startZahlen, waage, gleichungText, falle, steineGesamt, atomeIm, MAX_ZAHL, MAX_STEINE
} from './ausgleichen-logik.js';

const ROEMISCH = { I: 1, II: 2, III: 3, IV: 4 };

// Noppen eines Steins: Bei Metallen und Kohlenstoff als Element keine (nur zum Zählen).
function noppenFuer(symbol, stoff, elemente) {
  const e = elemente.find((x) => x.symbol === symbol);
  if (!e?.wertigkeit?.length) return 0;
  const nurEinElement = Object.keys(formelZaehlung(stoff.formel)).length === 1;
  if (nurEinElement && (e.metall || symbol === 'C')) return 0;
  const roemisch = stoff.name.match(/\((I{1,3}|IV)\)/);
  if (roemisch && e.wertigkeit.length > 1) return ROEMISCH[roemisch[1]];
  return e.wertigkeit[0];
}

function teilchenKnoten(stoff, elemente, klein) {
  const steine = [];
  for (const [, sym, n] of String(stoff.formel).matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    const e = elemente.find((x) => x.symbol === sym);
    for (let i = 0; i < (n ? Number(n) : 1); i++) steine.push(baustein(sym, { metall: e?.metall, noppen: noppenFuer(sym, stoff, elemente), klein: true }));
  }
  return el('span', { class: 'teilchen' + (klein ? ' teilchen-klein' : '') }, steine);
}

const zahlText = (n) => (n > 1 ? String(n) : '');

// optionen: { nurAnsehen, zahlen, verdeckt, beiAenderung(zahlen) }
export function gleichungsBaustelle(a, elemente, { nurAnsehen = false, zahlen: anfang = null, verdeckt = false, beiAenderung = () => {} } = {}) {
  const stoffe = alleStoffe(a);
  let zahlen = anfang ? [...anfang] : startZahlen(a);
  let gesperrt = nurAnsehen;
  let waageOffen = !verdeckt;
  const falleFormel = new Map(); // Stoff-Index -> gezeigte Fallen-Formel (nur kurz)

  const kartenBox = el('div', { class: 'gleichung-bau' });
  const waageBox = el('div', { class: 'waage-box', 'aria-live': 'polite' });
  const status = el('p', { class: 'bau-status', 'aria-live': 'polite' });

  function karte(stoff, i) {
    const n = zahlen[i];
    const klein = n >= 4;
    const formel = falleFormel.get(i);
    const plusMoeglich = n < MAX_ZAHL && steineGesamt(a, zahlen) + atomeIm(stoff.formel) <= MAX_STEINE;
    return el('div', { class: 'stoff-karte' + (formel ? ' falle-aktiv' : '') },
      el('div', { class: 'teilchen-box', 'aria-hidden': 'true' }, Array.from({ length: n }, () => teilchenKnoten(stoff, elemente, klein))),
      el('p', { class: 'stoff-formel' },
        formel ? [el('span', { class: 'marke-falsch' }, '✗ '), formelKnoten(formel)]
          : [el('span', { class: 'stoff-zahl' }, zahlText(n)), formelKnoten(stoff.formel)]),
      el('p', { class: 'stoff-name' }, stoff.name),
      gesperrt ? null : el('div', { class: 'stoff-steuerung' },
        el('button', { type: 'button', class: 'knopf knopf-rund', disabled: n <= 1, 'aria-label': `Ein Teilchen ${stoff.name} weniger`, onclick: () => aendern(i, -1) }, '−'),
        el('span', { class: 'stoff-anzahl', 'aria-label': `${n} Teilchen ${stoff.name}` }, String(n)),
        el('button', { type: 'button', class: 'knopf knopf-rund', disabled: !plusMoeglich, 'aria-label': `Ein Teilchen ${stoff.name} mehr`, onclick: () => aendern(i, +1) }, '+')),
      gesperrt ? null : el('button', { type: 'button', class: 'knopf knopf-klein knopf-leise falle-knopf', 'aria-label': `Bei ${stoff.name} ein Atom anhängen`, onclick: () => falleZeigen(i) }, '➕ Atom anhängen'));
  }

  function aendern(i, d) {
    if (gesperrt) return;
    const neu = zahlen[i] + d;
    if (neu < 1 || neu > MAX_ZAHL) return;
    zahlen[i] = neu;
    zeichnen();
    beiAenderung([...zahlen]);
  }

  function falleZeigen(i) {
    const stoff = stoffe[i];
    const f = falle(stoff, elemente);
    if (f.neu) { falleFormel.set(i, f.neu); zeichnen(); }
    const zurueck = () => { falleFormel.delete(i); zeichnen(); melden('Zurückgenommen. Ändere nur die große Zahl davor.'); };
    const zu = fenster(el('div', {},
      f.neu ? el('p', { class: 'falle-zeile' }, formelKnoten(stoff.formel), ' → ', el('span', { class: 'marke-falsch' }, '✗ '), formelKnoten(f.neu)) : null,
      el('p', { class: 'fenster-text' }, text(f.text)),
      el('div', { class: 'zeile-rechts' }, vorlesenKnopf(f.text))),
    { titel: '⚠ Atom anhängen?', knoepfe: (schliessen) => [el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => { schliessen(); zurueck(); } }, '↩ Zurücknehmen')] });
    // Auch beim Schließen über den Hintergrund zurücknehmen.
    const wache = setInterval(() => { if (!document.querySelector('.fenster-hintergrund') || !falleFormel.has(i)) { clearInterval(wache); if (falleFormel.has(i)) zurueck(); } }, 300);
    return zu;
  }

  const melden = (t, art = '') => { status.textContent = t; status.className = `bau-status ${art}`; };

  function waageZeichnen() {
    if (!waageOffen) {
      waageBox.replaceChildren(el('div', { class: 'waage verdeckt' }, el('p', {}, '⚖ Die Waage ist verdeckt. Zähl die Atome selbst.')));
      return;
    }
    const w = waage(a, zahlen);
    const neigung = w.ausgeglichen ? 0 : -w.kipp * 7;
    const lage = w.ausgeglichen ? 'Die Waage steht gerade.' : w.kipp > 0 ? 'Die Waage kippt nach links.' : w.kipp < 0 ? 'Die Waage kippt nach rechts.' : 'Die Waage wackelt: Die Elemente passen noch nicht.';
    waageBox.replaceChildren(el('div', { class: 'waage' + (w.ausgeglichen ? ' gerade' : '') },
      el('div', { class: 'waage-bild', role: 'img', 'aria-label': lage },
        el('div', { class: 'waage-balken', style: `transform: rotate(${neigung}deg)` },
          el('span', { class: 'waage-schale' }, 'links'), el('span', { class: 'waage-schale' }, 'rechts')),
        el('div', { class: 'waage-fuss' })),
      el('table', { class: 'waage-tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Element'), el('th', {}, 'links'), el('th', {}, 'rechts'), el('th', {}, el('span', { class: 'nur-vorlesen' }, 'gleich?')))),
        el('tbody', {}, w.zeilen.map((z) => el('tr', { class: z.gleich ? 'gleich' : 'ungleich' },
          el('th', { scope: 'row' }, baustein(z.symbol, { klein: true, metall: elemente.find((e) => e.symbol === z.symbol)?.metall })),
          el('td', {}, String(z.links)), el('td', {}, String(z.rechts)),
          el('td', { class: 'marke-zelle' }, z.gleich ? '✓' : '✗'))))),
      el('p', { class: 'waage-satz' }, lage, w.ausgeglichen && !w.kleinste ? ' Aber es geht mit kleineren Zahlen.' : '')));
  }

  function zeichnen() {
    const teile = [];
    stoffe.forEach((s, i) => {
      if (i === a.edukte.length) teile.push(el('span', { class: 'gleichung-pfeil', 'aria-label': 'reagiert zu' }, '→'));
      else if (i > 0) teile.push(el('span', { class: 'gleichung-plus', 'aria-hidden': 'true' }, '+'));
      teile.push(karte(s, i));
    });
    kartenBox.replaceChildren(...teile);
    waageZeichnen();
  }

  // Kurzer Tipp, warum O2 als Zweierteilchen, Metalle aber nur mit dem Symbol geschrieben werden.
  const zweierStoff = alleStoffe(a).find((s) => /^(O|H|N|Cl)2$/.test(s.formel));
  const metall = alleStoffe(a).find((s) => elemente.find((e) => e.symbol === s.formel)?.metall);
  const tippText = [
    zweierStoff ? `${zweierStoff.name} besteht aus Zweierteilchen (${zweierStoff.formel}).` : '',
    metall ? 'Metalle bilden große Verbände. Deshalb schreiben wir bei ihnen nur das Symbol.' : ''
  ].filter(Boolean).join(' ');
  const tippFrage = zweierStoff && metall ? `Warum ${zweierStoff.formel}, aber nur ${metall.formel}?`
    : zweierStoff ? `Warum ${zweierStoff.formel}?` : metall ? `Warum steht bei ${metall.formel} nur das Symbol?` : '';
  const tipp = tippText ? el('details', { class: 'tipp-box' },
    el('summary', {}, '💡 ', formelKnoten(tippFrage)),
    el('p', {}, text(tippText))) : null;

  zeichnen();
  return {
    wurzel: el('div', { class: 'ausgleichen' }, kartenBox, tipp, status, waageBox),
    zahlen: () => [...zahlen],
    setzeZahlen(neu) { zahlen = [...neu]; zeichnen(); },
    waageZeigen() { waageOffen = true; waageZeichnen(); },
    sperren() { gesperrt = true; melden(''); zeichnen(); },
    entsperren() { gesperrt = nurAnsehen; zeichnen(); },
    melden
  };
}

// ---------- Aufgabentyp „ausgleichen“ ----------

export function ausgleichenAufgabe(a, antworten, daten) {
  const elemente = daten.elemente;
  // ★★★: Waage verdeckt, bis man auf „Wiegen“ tippt. Bei „prüfen“-Aufgaben verdeckt bis zur Antwort.
  const verdeckt = Boolean(a.pruefen) || a.niveau === 3;
  let fertig = false;
  const gleichungZeile = el('p', { class: 'bau-formel', 'aria-live': 'polite' });
  const bau = gleichungsBaustelle(a, elemente, {
    nurAnsehen: Boolean(a.pruefen), verdeckt,
    beiAenderung: (zahlen) => {
      const w = waage(a, zahlen);
      if (w.geloest && !verdeckt && !fertig) { fertig = true; pruefKnopf.disabled = true; antworten(zahlen); return; }
      if (w.ausgeglichen && !w.kleinste) bau.melden(`💡 Die Waage steht gerade. Es geht aber mit kleineren Zahlen.`, 'tipp');
      else bau.melden('');
    }
  });

  if (a.pruefen) {
    const knoepfe = [['ja', 'Ja, ausgeglichen'], ['nein', 'Nein, nicht ausgeglichen']].map(([wert, t]) => el('button', {
      type: 'button', class: 'knopf antwort', 'data-wert': wert,
      onclick: (e) => { knoepfe.forEach((k) => { k.disabled = true; }); e.currentTarget.classList.add('gewaehlt'); antworten(wert); }
    }, t));
    return {
      wurzel: el('div', { class: 'ausgleichen-aufgabe' }, bau.wurzel, el('div', { class: 'antworten' }, knoepfe)),
      reihenfolge: () => null,
      ergebnis(wert, richtig, endgueltig) {
        const k = knoepfe.find((x) => x.dataset.wert === wert);
        k?.classList.remove('gewaehlt');
        k?.classList.add(richtig ? 'ist-richtig' : 'ist-falsch');
        k?.prepend(el('span', { class: 'marke', 'aria-hidden': 'true' }, richtig ? '✓' : '✗'), ' ');
        if (endgueltig) bau.waageZeigen();
      },
      nochmal() { knoepfe.forEach((k) => { if (!k.classList.contains('ist-falsch')) k.disabled = false; }); }
    };
  }

  const pruefKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', onclick: () => {
    fertig = true;
    pruefKnopf.disabled = true;
    bau.waageZeigen();
    antworten(bau.zahlen());
  } }, verdeckt ? '⚖ Wiegen und prüfen' : 'Fertig – prüfen');
  return {
    wurzel: el('div', { class: 'ausgleichen-aufgabe' }, bau.wurzel, gleichungZeile, pruefKnopf),
    reihenfolge: () => bau.zahlen(),
    ergebnis(wert, richtig, endgueltig) {
      bau.waageZeigen();
      if (richtig) {
        bau.sperren();
        pruefKnopf.hidden = true;
        gleichungZeile.replaceChildren(el('span', { class: 'marke' }, '✓'), ' ', el('b', {}, formelKnoten(gleichungText(a, wert))));
        gleichungZeile.classList.add('ist-richtig');
        return;
      }
      bau.sperren();
      if (endgueltig) {
        bau.setzeZahlen(a.loesung);
        pruefKnopf.hidden = true;
        gleichungZeile.replaceChildren('So ist es richtig: ', el('b', {}, formelKnoten(gleichungText(a, a.loesung))));
      }
    },
    nochmal(hinweis) {
      fertig = false;
      pruefKnopf.disabled = false;
      bau.entsperren();
      if (hinweis) bau.melden(`💡 ${hinweis}`, 'tipp');
    }
  };
}
