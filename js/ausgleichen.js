// Bereich 2: Reaktionen mit Bausteinen ausgleichen.
// Links die Edukte, rechts die Produkte als flache Bausteine (schont alte iPads).
// Mit + und – nimmt man ein ganzes Teilchen dazu oder weg. Die Waage zählt jedes Element links und rechts.
// „Atom anhängen“ zeigt die Index-Falle: Es entstünde ein anderer Stoff. Die Änderung wird sofort zurückgenommen.
import { el, formelKnoten } from './hilfen.js';
import { baustein, fenster, vorlesenKnopf, text } from './ui.js';
import { formelZaehlung } from './bausteine-logik.js';
import {
  alleStoffe, startZahlen, waage, gleichungText, falle, steineGesamt, atomeIm, ausgleichHinweis, MAX_ZAHL, MAX_STEINE
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
  const waageBild = el('div');
  // Ein einziges, festes Live-Element für den Waagensatz: VoiceOver sagt jede Änderung an.
  const waageSatz = el('p', { class: 'waage-satz', 'aria-live': 'polite' });
  const waageBox = el('div', { class: 'waage-box' }, waageBild, waageSatz);
  const status = el('p', { class: 'bau-status', 'aria-live': 'polite' });
  const statusZeile = el('div', { class: 'bau-status-zeile', hidden: true }, status, vorlesenKnopf(() => status.textContent, 'Hinweis vorlesen'));

  function karte(stoff, i) {
    const n = zahlen[i];
    const formel = falleFormel.get(i);
    const plusMoeglich = n < MAX_ZAHL && steineGesamt(a, zahlen) + atomeIm(stoff.formel) <= MAX_STEINE;
    // Reihenfolge: Formel, Name, Knöpfe – darunter die Teilchen. So wandern die Knöpfe nicht, wenn Teilchen dazukommen.
    return el('div', { class: 'stoff-karte' + (formel ? ' falle-aktiv' : '') },
      el('p', { class: 'stoff-formel' },
        formel ? [el('span', { class: 'marke-falsch' }, '✗ '), formelKnoten(formel)]
          : [el('span', { class: 'stoff-zahl' }, zahlText(n)), formelKnoten(stoff.formel)]),
      el('p', { class: 'stoff-name' }, stoff.name),
      gesperrt ? null : el('div', { class: 'stoff-steuerung' },
        el('button', { type: 'button', class: 'knopf knopf-rund', 'data-stoff': i, 'data-aktion': 'minus', disabled: n <= 1, 'aria-label': `Minus: Ein Teilchen ${stoff.name} weniger`, onclick: () => aendern(i, -1) }, '−'),
        el('span', { class: 'stoff-anzahl', 'aria-hidden': 'true' }, String(n)),
        el('button', { type: 'button', class: 'knopf knopf-rund', 'data-stoff': i, 'data-aktion': 'plus', disabled: !plusMoeglich, 'aria-label': `Plus: Ein Teilchen ${stoff.name} mehr (jetzt ${n})`, onclick: () => aendern(i, +1) }, '+')),
      el('div', { class: 'teilchen-box' + (n >= 3 ? ' viele' : ''), 'aria-hidden': 'true' }, Array.from({ length: n }, () => teilchenKnoten(stoff, elemente, n >= 4))),
      gesperrt ? null : el('button', { type: 'button', class: 'knopf knopf-klein knopf-leise falle-knopf', 'data-stoff': i, 'data-aktion': 'falle', 'aria-label': `Bei ${stoff.name} ein Atom anhängen`, onclick: () => falleZeigen(i) }, '➕ Atom anhängen'));
  }

  function aendern(i, d) {
    if (gesperrt) return;
    const neu = zahlen[i] + d;
    if (neu < 1 || neu > MAX_ZAHL) return;
    zahlen[i] = neu;
    zeichnen();
    beiAenderung([...zahlen]);
  }

  function fokussieren(i, aktion) {
    const k = kartenBox.querySelector(`[data-stoff="${i}"][data-aktion="${aktion}"]`);
    (k && !k.disabled ? k : kartenBox.querySelector(`[data-stoff="${i}"]:not([disabled])`))?.focus({ preventScroll: true });
  }

  function falleZeigen(i) {
    const stoff = stoffe[i];
    const f = falle(stoff, elemente);
    const zurueck = () => {
      if (!falleFormel.has(i) && !f.neu) { fokussieren(i, 'falle'); return; }
      falleFormel.delete(i);
      zeichnen();
      melden('Zurückgenommen. Ändere nur die große Zahl davor.');
      fokussieren(i, 'falle');
    };
    // Erst das Fenster öffnen (es merkt sich den Knopf), dann die Formel kurz verändert zeigen.
    fenster(el('div', {},
      f.neu ? el('p', { class: 'falle-zeile' }, formelKnoten(stoff.formel), ' → ', el('span', { class: 'marke-falsch' }, '✗ '), formelKnoten(f.neu)) : null,
      el('p', { class: 'fenster-text' }, text(f.text)),
      el('div', { class: 'zeile-rechts' }, vorlesenKnopf(f.text))),
    { titel: '⚠ Atom anhängen?', knoepfe: (schliessen) => [el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => { schliessen(); zurueck(); } }, f.neu ? '↩ Zurücknehmen' : 'Verstanden')] });
    if (f.neu) { falleFormel.set(i, f.neu); zeichnen(); }
    // Auch beim Schließen über den Hintergrund zurücknehmen.
    const wache = setInterval(() => {
      if (document.querySelector('.fenster-hintergrund')) return;
      clearInterval(wache);
      if (falleFormel.has(i)) zurueck();
    }, 300);
  }

  const melden = (t, art = '') => { status.textContent = t; status.className = `bau-status ${art}`; statusZeile.hidden = !t; };

  function waageZeichnen() {
    if (!waageOffen) {
      waageBild.replaceChildren(el('div', { class: 'waage verdeckt' }, el('p', {}, '⚖ Die Waage ist verdeckt. Zähl die Atome selbst.')));
      waageSatz.textContent = '';
      return;
    }
    const w = waage(a, zahlen);
    // Gleich viele Atome insgesamt, aber nicht pro Element: Die Waage wackelt (steht nicht gerade).
    const neigung = w.ausgeglichen ? 0 : w.kipp === 0 ? 4 : -w.kipp * 8;
    const lage = w.ausgeglichen ? '✓ Die Waage steht gerade.' : w.kipp > 0 ? 'Die Waage kippt nach links.' : w.kipp < 0 ? 'Die Waage kippt nach rechts.' : 'Die Waage wackelt: Die Elemente passen noch nicht.';
    waageBild.replaceChildren(el('div', { class: 'waage' + (w.ausgeglichen ? ' gerade' : '') },
      el('div', { class: 'waage-bild', 'aria-hidden': 'true' },
        el('div', { class: 'waage-balken', style: `transform: rotate(${neigung}deg)` },
          el('span', { class: 'waage-schale' }, 'links'), el('span', { class: 'waage-schale' }, 'rechts')),
        el('div', { class: 'waage-fuss' })),
      el('ul', { class: 'waage-liste', 'aria-label': 'Atome pro Element' }, w.zeilen.map((z) => el('li', { class: z.gleich ? 'gleich' : 'ungleich' },
        baustein(z.symbol, { klein: true, metall: elemente.find((e) => e.symbol === z.symbol)?.metall }),
        el('span', { class: 'waage-zahlen' }, el('span', { class: 'nur-vorlesen' }, `${z.symbol}: links `), String(z.links),
          el('span', { 'aria-hidden': 'true' }, ' | '), el('span', { class: 'nur-vorlesen' }, ', rechts '), String(z.rechts)),
        el('b', { class: 'marke-zelle' }, el('span', { 'aria-hidden': 'true' }, z.gleich ? '✓' : '✗'), el('span', { class: 'nur-vorlesen' }, z.gleich ? ' gleich' : ' ungleich')))))));
    waageBox.classList.toggle('gerade', w.ausgeglichen);
    const satz = `${lage}${w.ausgeglichen && !w.kleinste ? ' Aber es geht mit kleineren Zahlen davor.' : ''}`;
    if (waageSatz.textContent !== satz) waageSatz.textContent = satz;
  }

  function zeichnen() {
    // Fokus merken (VoiceOver, Tastatur, Schaltersteuerung) und nach dem Neuzeichnen wiederherstellen.
    const aktiv = kartenBox.contains(document.activeElement) ? document.activeElement : null;
    const merke = aktiv ? [aktiv.dataset.stoff, aktiv.dataset.aktion] : null;
    const edukte = []; const produkte = [];
    stoffe.forEach((s, i) => {
      const ziel = i < a.edukte.length ? edukte : produkte;
      if (ziel.length) ziel.push(el('span', { class: 'gleichung-plus', 'aria-hidden': 'true' }, '+'));
      ziel.push(karte(s, i));
    });
    kartenBox.replaceChildren(
      el('div', { class: 'gleichung-seite' }, edukte),
      el('span', { class: 'gleichung-pfeil', role: 'img', 'aria-label': 'reagiert zu' }, '→'),
      el('div', { class: 'gleichung-seite' }, produkte));
    if (merke) fokussieren(merke[0], merke[1]);
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
    el('summary', {}, el('span', {}, '💡 ', formelKnoten(tippFrage))),
    el('div', { class: 'tipp-inhalt' }, el('p', {}, text(tippText)), vorlesenKnopf(tippText, 'Tipp vorlesen'))) : null;

  zeichnen();
  return {
    wurzel: el('div', { class: 'ausgleichen' }, kartenBox, tipp, statusZeile, waageBox),
    zahlen: () => [...zahlen],
    setzeZahlen(neu) { zahlen = [...neu]; zeichnen(); },
    waageZeigen() { waageOffen = true; waageZeichnen(); },
    sperren() { gesperrt = true; melden(''); zeichnen(); },
    entsperren() { gesperrt = nurAnsehen; zeichnen(); },
    melden
  };
}

// ---------- Aufgabentyp „ausgleichen“ ----------

export function ausgleichenAufgabe(a, antworten, daten, { rundeNiveau = null } = {}) {
  const elemente = daten.elemente;
  // ★★★-Runde: Waage verdeckt, bis man auf „Wiegen“ tippt – auch bei den leichteren Einstiegsaufgaben.
  // Bei „prüfen“-Aufgaben verdeckt bis zur Antwort.
  const verdeckt = Boolean(a.pruefen) || (rundeNiveau ?? a.niveau) === 3;
  let fertig = false;
  const gleichungZeile = el('p', { class: 'bau-formel', 'aria-live': 'polite' });
  const bau = gleichungsBaustelle(a, elemente, {
    nurAnsehen: Boolean(a.pruefen), verdeckt,
    beiAenderung: (zahlen) => {
      const w = waage(a, zahlen);
      if (w.geloest && !verdeckt && !fertig) { fertig = true; pruefKnopf.disabled = true; antworten(zahlen); return; }
      // Bei verdeckter Waage (★★★) verrät die App nichts – auch nicht, dass sie gerade steht.
      if (!verdeckt && w.ausgeglichen && !w.kleinste) bau.melden('💡 Die Waage steht gerade. Es geht aber mit kleineren Zahlen davor.', 'tipp');
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

  // ★/★★: Die Waage löst selbst, sobald sie gerade steht. Der Knopf hilft erst (ohne Versuch zu verbrauchen),
  // erst der zweite Tipp wertet. ★★★: „Wiegen und prüfen“ wertet sofort.
  let hilfeGezeigt = false;
  const pruefText = verdeckt ? '⚖ Wiegen und prüfen' : '💡 Ich komme nicht weiter';
  const pruefKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', onclick: () => {
    if (!verdeckt && !hilfeGezeigt) {
      hilfeGezeigt = true;
      const h = ausgleichHinweis(a, bau.zahlen());
      bau.melden(`💡 ${h || a.denkanstoss}`, 'tipp');
      pruefKnopf.textContent = 'Prüfen (zählt als Versuch)';
      return;
    }
    // Der Hinweis steht gleich in der Rückmeldung – nicht doppelt in der Statuszeile.
    bau.melden('');
    fertig = true;
    pruefKnopf.disabled = true;
    bau.waageZeigen();
    antworten(bau.zahlen());
  } }, pruefText);
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
      hilfeGezeigt = true;
      pruefKnopf.textContent = verdeckt ? '⚖ Wiegen und prüfen' : 'Prüfen (zählt als Versuch)';
      pruefKnopf.disabled = false;
      bau.entsperren();
      if (hinweis) bau.melden(`💡 ${hinweis}`, 'tipp');
    }
  };
}
