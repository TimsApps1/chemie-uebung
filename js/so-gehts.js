// „So geht’s“ für Bereich 1: in 5 Schritten zeigen, dass jede Noppe genau eine Bindung ist.
// Läuft im Fenster mit der echten 3D-Baustelle (nur ansehen), damit das Bild genauso aussieht wie beim Bauen.
import { el } from './hilfen.js';
import { fenster, vorlesenKnopf, text } from './ui.js';
import { baustelle, buehnenHoehe } from './baustelle.js';
import { leeresModell, steinArt, ersterStein, anstecken, verbinden } from './bausteine-logik.js';

function schritte(elemente) {
  const art = (x) => steinArt(x, elemente);
  const o = leeresModell(); ersterStein(o, art('O'));
  const ho = leeresModell(); ersterStein(ho, art('O')); anstecken(ho, art('H'), 1);
  const hoh = leeresModell(); ersterStein(hoh, art('O')); anstecken(hoh, art('H'), 1); anstecken(hoh, art('H'), 1);
  const mgo = leeresModell(); ersterStein(mgo, art('Mg')); anstecken(mgo, art('O'), 1); verbinden(mgo, 1, 2);
  return [
    { modell: o, text: 'Das ist ein O-Stein. Er hat 2 Noppen. Das ist seine Wertigkeit: O hat die Wertigkeit 2.' },
    { modell: ho, text: 'An jede Noppe kommt genau eine Bindung. H hat nur 1 Noppe. Am O ist noch 1 Noppe frei – sie ist gelb.' },
    { modell: hoh, text: 'Jetzt sind alle Noppen belegt. Keine Noppe ist mehr gelb. Fertig: H2O.' },
    { modell: mgo, text: 'Zwei Noppen können auch zum selben Partner gehen. Mg und O haben je 2 Noppen: zwei Stege, eine Doppelbindung. MgO.' },
    { modell: mgo, text: 'So baust du: Tippe unten einen Stein an, dann eine gelbe Noppe. Zum Verbinden tippst du erst den einen Stein an, dann den anderen.' }
  ];
}

export function soGehtsZeigen(elemente, weiter) {
  const liste = schritte(elemente);
  let nr = 0;
  const bau = baustelle({ modell: liste[0].modell, nurAnsehen: true, hoehe: Math.min(260, buehnenHoehe(0.3)) });
  const satz = el('p', { class: 'fenster-text so-gehts-text', 'aria-live': 'polite' });
  const zaehler = el('p', { class: 'leise' });
  const zurueck = el('button', { type: 'button', class: 'knopf', onclick: () => zeige(nr - 1) }, '◀ Zurück');
  let schliessen = null;
  const weiterKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
    if (nr < liste.length - 1) return zeige(nr + 1);
    schliessen?.();
    weiter?.();
  } }, 'Weiter ▶');
  function zeige(i) {
    nr = Math.max(0, Math.min(liste.length - 1, i));
    satz.replaceChildren(text(liste[nr].text));
    zaehler.textContent = `Schritt ${nr + 1} von ${liste.length}`;
    zurueck.disabled = nr === 0;
    weiterKnopf.textContent = nr === liste.length - 1 ? 'Los geht’s ➜' : 'Weiter ▶';
    bau.setzeModell(liste[nr].modell);
  }
  schliessen = fenster(el('div', { class: 'so-gehts' },
    el('div', { class: 'anweisung-zeile' }, satz, vorlesenKnopf(() => liste[nr].text)),
    bau.wurzel,
    zaehler,
    el('p', { class: 'tipp' }, 'Die Wertigkeit ist ein Hilfsmodell. Später lernst du mehr darüber.')),
  { titel: '🧱 So geht’s', knoepfe: () => [zurueck, weiterKnopf] });
  zeige(0);
}
