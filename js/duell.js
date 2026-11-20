// Duell: Zwei Kinder spielen abwechselnd am selben iPad, jedes auf seinem eigenen Niveau.
// Wer zuerst 10 Punkte hat, ist zuerst am Ziel (★ = 1, ★★ = 2, ★★★ = 3 Punkte pro richtiger Antwort).
// Am Ende: „Gut gespielt, beide!“ – kein Verlierer-Bild, kein Punktecode, nichts wird gespeichert.
import { el, sterneText } from './hilfen.js';
import { kopfSetzen, iconKnopf, baustein, text, vorlesenKnopf, tonSpielen } from './ui.js';
import { kinder, profil, vorname } from './profil.js';
import { aufgabenWaehlen } from './runde.js';
import { aufgabeDarstellen, pruefen, vorleseText, loesungsText } from './aufgaben.js';

export const DUELL_ZIEL = 10;

export function duellStarten({ ziel, daten, zurueck }) {
  const zeigen = (...k) => { ziel.replaceChildren(...k.filter(Boolean)); window.scrollTo(0, 0); };
  const liste = kinder().filter((k) => !k.gesperrt).sort((a, b) => a.name.localeCompare(b.name));
  const wahl = { spieler: [], bereich: null, niveau: {} };

  const gemeinsameBereiche = () => {
    if (wahl.spieler.length < 2) return [];
    const [p1, p2] = wahl.spieler.map((n) => profil(n));
    return daten.bereiche.filter((b) => !b.kommt_bald && p1.freigeschaltet[b.id] && p2.freigeschaltet[b.id] && (daten.aufgaben[b.id] || []).length);
  };

  function einrichten() {
    kopfSetzen({ titel: '⚔ Duell', links: iconKnopf('i-zurueck', 'Zurück', zurueck, 'knopf-rund kopf-knopf') });
    const bereiche = gemeinsameBereiche();
    if (wahl.bereich && !bereiche.some((b) => b.id === wahl.bereich)) wahl.bereich = null;
    if (!wahl.bereich && bereiche.length === 1) wahl.bereich = bereiche[0].id;
    const spielerKnoepfe = el('div', { class: 'namen' }, liste.map((k) => {
      const an = wahl.spieler.includes(k.name);
      return el('button', { type: 'button', class: 'knopf knopf-name' + (an ? ' gewaehlt' : ''), 'aria-pressed': String(an), 'aria-label': k.anzeige || k.name,
        onclick: () => {
          if (an) wahl.spieler = wahl.spieler.filter((n) => n !== k.name);
          else if (wahl.spieler.length < 2) wahl.spieler.push(k.name);
          else wahl.spieler = [wahl.spieler[1], k.name];
          einrichten();
        } }, baustein(k.element || 'H', { klein: true }), el('span', {}, vorname(k.name)), an ? el('small', { class: 'name-kurz' }, '✓ dabei') : null);
    }));
    const niveauWahl = (name) => {
      const p = profil(name);
      if (!wahl.niveau[name]) wahl.niveau[name] = p.letzte?.bereich === wahl.bereich ? p.letzte.niveau : 1;
      return el('div', { class: 'duell-niveau' },
        el('b', {}, vorname(name)),
        el('div', { class: 'zeile', role: 'radiogroup', 'aria-label': `Niveau für ${vorname(name)}` }, [1, 2, 3].map((n) =>
          el('button', { type: 'button', class: 'knopf' + (wahl.niveau[name] === n ? ' knopf-haupt' : ''), role: 'radio', 'aria-checked': String(wahl.niveau[name] === n),
            'aria-label': `${sterneText(n)}, ${n} ${n === 1 ? 'Punkt' : 'Punkte'} pro richtiger Antwort`,
            onclick: () => { wahl.niveau[name] = n; einrichten(); } }, `${sterneText(n)} · ${n} P.`))));
    };
    const bereit = wahl.spieler.length === 2 && wahl.bereich;
    zeigen(el('section', { class: 'karte' },
      el('div', { class: 'anweisung-zeile' }, el('h2', { class: 'titel' }, 'Duell zu zweit'),
        vorlesenKnopf('Duell zu zweit. Tippe auf zwei Namen. Ihr spielt abwechselnd. Wer zuerst 10 Punkte hat, ist zuerst am Ziel.')),
      el('p', { class: 'leise' }, `✋ Tippe auf zwei Namen. Ihr spielt abwechselnd. Wer zuerst ${DUELL_ZIEL} Punkte hat, ist zuerst am Ziel.`),
      liste.length < 2 ? el('p', { class: 'meldung' }, 'Für ein Duell braucht es zwei Namen auf diesem iPad.') : spielerKnoepfe,
      wahl.spieler.length === 2 ? [
        el('h3', {}, 'Bereich'),
        bereiche.length ? el('div', { class: 'zeile' }, bereiche.map((b) => el('button', { type: 'button', class: 'knopf' + (wahl.bereich === b.id ? ' knopf-haupt' : ''),
          'aria-pressed': String(wahl.bereich === b.id), onclick: () => { wahl.bereich = b.id; einrichten(); } }, b.titel)))
          : el('p', { class: 'meldung' }, 'Ihr habt noch keinen gemeinsamen Bereich freigeschaltet.'),
        ...(wahl.bereich ? [el('h3', {}, 'Niveau – jedes Kind wählt selbst'), el('p', { class: 'leise' }, 'Schwierigere Aufgaben bringen mehr Punkte. So ist es fair.'),
          ...wahl.spieler.map(niveauWahl)] : [])] : null,
      el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', disabled: !bereit, onclick: spielen }, '⚔ Los geht’s')));
  }

  function spielen() {
    const spieler = wahl.spieler.map((name) => {
      const p = profil(name);
      return { name, niveau: wahl.niveau[name], kurs: p.freigeschaltet[wahl.bereich], punkte: 0, stapel: [], richtig: 0 };
    });
    let dran = 0;
    const naechsteAufgabe = (s) => {
      if (!s.stapel.length) s.stapel = aufgabenWaehlen(daten.aufgaben[wahl.bereich] || [], s.niveau, s.kurs, []);
      return s.stapel.shift();
    };

    function stand() {
      return el('div', { class: 'duell-stand', role: 'group', 'aria-label': 'Punktestand' }, spieler.map((s, i) => el('div', { class: 'duell-spieler' + (i === dran ? ' dran' : '') },
        el('span', { class: 'duell-name' }, vorname(s.name), el('small', {}, ` ${sterneText(s.niveau)}`)),
        el('span', { class: 'duell-balken', role: 'img', 'aria-label': `${vorname(s.name)}: ${s.punkte} von ${DUELL_ZIEL} Punkten` },
          el('span', { style: `width:${Math.min(100, (s.punkte / DUELL_ZIEL) * 100)}%` })),
        el('b', { class: 'duell-punkte' }, `${s.punkte}/${DUELL_ZIEL}`))));
    }

    function zug() {
      const s = spieler[dran];
      const a = naechsteAufgabe(s);
      if (!a) return einrichten();
      kopfSetzen({ titel: '⚔ Duell', links: iconKnopf('i-zurueck', 'Duell beenden', zurueck, 'knopf-rund kopf-knopf') });
      const rueck = el('div', { 'aria-live': 'polite' });
      let fertig = false;
      const darstellung = aufgabeDarstellen(a, (wert) => {
        if (fertig) return;
        fertig = true;
        const richtig = pruefen(a, wert, daten);
        darstellung.ergebnis(wert, richtig, true);
        tonSpielen(richtig);
        if (richtig) { s.punkte += s.niveau; s.richtig += 1; }
        const ende = s.punkte >= DUELL_ZIEL;
        const anderer = spieler[1 - dran];
        rueck.replaceChildren(el('div', { class: `rueckmeldung ${richtig ? 'richtig' : 'falsch'}`, role: 'status' },
          el('span', { class: 'marke', 'aria-hidden': 'true' }, richtig ? '✓' : '✗'),
          el('p', { class: 'rueckmeldung-titel' }, richtig ? `Richtig! +${s.niveau}` : 'Diesmal nicht.'),
          richtig ? null : el('div', { class: 'denkanstoss breit' }, el('p', {}, el('b', {}, 'Lösung: '), text(loesungsText(a, daten)))),
          a.erklaerung ? el('div', { class: 'breit' }, el('p', { class: 'leise' }, text(a.erklaerung))) : null),
        el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: () => {
          if (ende) return schluss(s);
          dran = 1 - dran;
          zug();
        } }, ende ? 'Zum Ergebnis ➜' : `Weiter: ${vorname(anderer.name)} ist dran ➜`));
        rueck.querySelector('button')?.focus();
        karte.querySelector('.duell-stand')?.replaceWith(stand());
      }, daten);
      const karte = el('section', { class: 'karte aufgabe' },
        stand(),
        el('p', { class: 'duell-dran' }, el('b', {}, `${vorname(s.name)} ist dran`), ` · ${sterneText(s.niveau)}`),
        el('div', { class: 'anweisung-zeile' },
          el('p', { class: 'anweisung' }, el('span', { class: 'anweisung-zeichen', 'aria-hidden': 'true' }, a.symbol || '❓'), el('span', {}, text(a.frage))),
          vorlesenKnopf(() => vorleseText(a, typeof darstellung.reihenfolge === 'function' ? darstellung.reihenfolge() : darstellung.reihenfolge))),
        darstellung.wurzel,
        rueck);
      zeigen(karte);
    }

    function schluss(erster) {
      kopfSetzen({ titel: '⚔ Duell', links: iconKnopf('i-zurueck', 'Zurück', zurueck, 'knopf-rund kopf-knopf') });
      zeigen(el('section', { class: 'karte ergebnis' },
        el('h2', { class: 'titel' }, '🤝 Gut gespielt, beide!'),
        el('p', { class: 'ergebnis-satz' }, `${vorname(erster.name)} hat zuerst ${DUELL_ZIEL} Punkte erreicht.`),
        el('ul', { class: 'neu-liste' }, spieler.map((s) => el('li', { class: 'neu-zeile' },
          el('span', { class: 'neu-zeichen', 'aria-hidden': 'true' }, '⭐'),
          el('span', {}, el('b', {}, vorname(s.name)), ` · ${sterneText(s.niveau)} · ${s.punkte} Punkte · ${s.richtig} ${s.richtig === 1 ? 'Aufgabe' : 'Aufgaben'} richtig`)))),
        el('p', { class: 'leise' }, 'Im Duell gibt es keinen Punktecode. Es zählt nur der Spaß.'),
        el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: spielen }, '⚔ Nochmal'),
        el('button', { type: 'button', class: 'knopf knopf-gross knopf-breit', onclick: zurueck }, 'Fertig')));
    }

    zug();
  }

  einrichten();
}
