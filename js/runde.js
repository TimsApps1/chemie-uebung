// Ablauf einer Übungsrunde: 8 Aufgaben, Denkanstoß, 2. Versuch, Lösung, Wiederholung am Ende.
import { el, mischen, sterneText } from './hilfen.js';
import { kopfSetzen, icon, iconKnopf, text, vorlesenKnopf, vorlesenStoppen, fenster, fragen, tonSpielen } from './ui.js';
import { aufgabeDarstellen, pruefen, fehlerHinweis, loesungsText, vorleseText } from './aufgaben.js';
import { fehlerMerken, fehlerWiederholt, kannZaehlen, geraet } from './profil.js';

export const RUNDE_LAENGE = 8;
const ZEIT_PRO_AUFGABE = 45; // Sekunden, nur ★★★
const PUNKTE = { erster: 10, zweiter: 5, warum: 5 };

const LOB_STANDARD = {
  erster: ['Richtig!', 'Stimmt genau!', 'Gut gemacht!', 'Sehr gut!'],
  zweiter: ['Beim 2. Versuch richtig – gut nachgedacht!', 'Richtig! Der Denkanstoß hat geholfen.', 'Gut, dass du drangeblieben bist!'],
  ausgebessert: ['Ausgebessert! Diesmal hat es geklappt.', 'Super, jetzt sitzt es!']
};

function lob(daten, art) {
  const liste = daten.app.lob?.[art]?.length ? daten.app.lob[art] : LOB_STANDARD[art];
  return liste[Math.floor(Math.random() * liste.length)];
}

// ---------- Aufgaben für eine Runde auswählen ----------

function passtZumKurs(a, kurs) {
  return a.kurs !== 'E' || kurs === 'E';
}

// zuletzt = IDs der zuletzt gesehenen Aufgaben; sie kommen nur dran, wenn sonst zu wenig da ist.
export function aufgabenWaehlen(alle, niveau, kurs, zuletzt = []) {
  const kuerzlich = new Set(zuletzt);
  const frischZuerst = (liste) => [...mischen(liste.filter((a) => !kuerzlich.has(a.id))), ...mischen(liste.filter((a) => kuerzlich.has(a.id)))];
  const pool = alle.filter((a) => a.niveau === niveau && passtZumKurs(a, kurs));
  const einstiegPool = niveau > 1
    ? alle.filter((a) => a.niveau === niveau - 1 && passtZumKurs(a, kurs))
    : pool.filter((a) => a.leicht);
  // Einstieg: höchstens eine von der App erzeugte Aufgabe.
  const einstiegQuelle = frischZuerst(einstiegPool.length >= 2 ? einstiegPool : pool);
  const einstieg = [];
  for (const a of einstiegQuelle) {
    if (einstieg.length >= 2) break;
    if (a.generiert && einstieg.some((x) => x.generiert)) continue;
    einstieg.push(a);
  }
  const rest = frischZuerst(pool.filter((a) => !einstieg.includes(a)));
  // Höchstens 2 Sortieraufgaben (dauern länger) und 3 von der App erzeugte Aufgaben pro Runde,
  // damit die selbst geschriebenen Aufgaben im Mittelpunkt bleiben.
  const auswahl = [];
  const zahl = (liste, test) => liste.filter(test).length;
  const passt = (a, liste) => !(a.typ === 'sortieren' && zahl(liste, (x) => x.typ === 'sortieren') >= 2) &&
    !(a.generiert && zahl(liste, (x) => x.generiert) >= 3) &&
    zahl(liste, (x) => x.typ === a.typ) < 4;
  for (const a of rest) {
    if (auswahl.length >= RUNDE_LAENGE - einstieg.length) break;
    if (passt(a, [...einstieg, ...auswahl])) auswahl.push(a);
  }
  // Falls zu wenig übrig ist, mit den übrigen auffüllen.
  for (const a of rest) {
    if (auswahl.length >= RUNDE_LAENGE - einstieg.length) break;
    if (!auswahl.includes(a)) auswahl.push(a);
  }
  return [...einstieg, ...auswahl];
}

// ---------- Runde spielen ----------
// art: 'normal' oder 'fehler' (Meine Fehler wiederholen)
// Liefert per fertig(...) das Ergebnis oder null bei Abbruch.

export function rundeSpielen({ ziel, daten, name, bereich, niveau, kurs, aufgaben, art = 'normal', fertig }) {
  const zeitlimit = art === 'normal' && niveau === 3 && !geraet().zeitlimitAus && daten.app.zeitlimit !== false;
  const mitWarum = art === 'normal' && niveau === 3;
  const bereichInfo = daten.bereiche.find((b) => b.id === bereich);
  const farbe = bereich.toLowerCase();
  const stand = {
    punkte: 0, ersterVersuch: 0, beantwortet: 0, warumRichtig: 0,
    nochmal: [], falsch: [], ausgebessert: 0, abgebrochen: false
  };
  let liste = [...aufgaben];
  let index = 0;
  let wiederholung = false;
  let zeitgeber = null;

  kopfSetzen({
    titel: art === 'fehler' ? 'Meine Fehler' : bereichInfo?.titel || bereich,
    farbe,
    links: iconKnopf('i-haus', 'Runde abbrechen', abbrechen, 'knopf-rund kopf-knopf'),
    rechts: art === 'normal' ? [el('span', { class: 'kopf-niveau sterne' }, sterneText(niveau))] : []
  });

  async function abbrechen() {
    const ja = await fragen('Runde abbrechen? Die Punkte dieser Runde zählen dann nicht.', 'Ja, abbrechen', 'Weiter üben');
    if (!ja) return;
    stand.abgebrochen = true;
    aufraeumen();
    fertig(null);
  }

  function aufraeumen() {
    clearInterval(zeitgeber);
    vorlesenStoppen();
  }

  function fortschritt() {
    if (wiederholung) {
      return el('div', { class: 'fortschritt' },
        el('span', { class: 'fortschritt-text' }, `Nochmal: ${index - aufgaben.length + 1} von ${liste.length - aufgaben.length}`));
    }
    const schritte = el('ol', { class: 'schritte', 'aria-hidden': 'true' });
    for (let i = 0; i < aufgaben.length; i++) {
      schritte.append(el('li', { class: i < index ? 'fertig' : i === index ? 'jetzt' : '' }));
    }
    return el('div', { class: 'fortschritt', style: `--balken: var(--${farbe})` },
      el('span', { class: 'fortschritt-text' }, `${index + 1} von ${aufgaben.length}`), schritte);
  }

  // Ruhiger Zeitbalken (nur ★★★). Er hält an, solange ein Fenster offen ist oder vorgelesen wird,
  // und kostet keine Punkte – er zeigt nur, wie lange man ungefähr braucht.
  function zeitbalken() {
    const innen = el('span');
    const balken = el('div', { class: 'zeitbalken', role: 'img', 'aria-label': 'Zeitbalken' }, innen);
    let vergangen = 0;
    let letzte = Date.now();
    clearInterval(zeitgeber);
    zeitgeber = setInterval(() => {
      const jetzt = Date.now();
      const pause = document.querySelector('.fenster-hintergrund') || window.speechSynthesis?.speaking || document.hidden;
      if (!pause) vergangen += jetzt - letzte;
      letzte = jetzt;
      const rest = Math.max(0, 1 - vergangen / (ZEIT_PRO_AUFGABE * 1000));
      innen.style.width = `${rest * 100}%`;
      if (rest === 0) {
        clearInterval(zeitgeber);
        balken.classList.add('abgelaufen');
        balken.setAttribute('aria-label', 'Die Zeit ist um. Du kannst in Ruhe weitermachen.');
        balken.after(el('p', { class: 'tipp' }, '⏳ Die Zeit ist um. Mach in Ruhe weiter.'));
      }
    }, 500);
    return balken;
  }

  // Rückmeldung immer ins Bild holen (sonst liegt sie auf dem iPad unter dem Bildschirmrand).
  function zeigenWennNoetig(bereich) {
    new MutationObserver(() => {
      if (!bereich.childElementCount) return;
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => bereich.scrollIntoView({ block: 'nearest', behavior: ruhig ? 'auto' : 'smooth' }));
    }).observe(bereich, { childList: true });
  }

  function naechste() {
    aufraeumen();
    // Falsch beantwortete Aufgaben kommen am Ende noch einmal.
    if (index >= liste.length && stand.nochmal.length && liste.length === aufgaben.length) {
      liste = [...aufgaben, ...stand.nochmal];
    }
    if (index >= liste.length) return ende();
    wiederholung = index >= aufgaben.length;
    const a = liste[index];
    zeigeAufgabe(a);
  }

  // Kurzer Konzept-Hinweis für "Erklär's mir" VOR der Antwort (verrät die Lösung nicht).
  function konzeptHilfe(a) {
    if (a.hilfe_vorher === false) return 'Lies die Frage genau. Tippe auf ein unterstrichenes Wort, wenn du es nicht kennst. Nach deiner Antwort bekommst du hier die ganze Erklärung.';
    const kann = daten.bereiche.flatMap((b) => b.ich_kann || []).find((k) => k.id === a.kann);
    if (kann?.hilfe && (!kann.kurs || kurs === 'E')) return kann.hilfe;
    return a.denkanstoss;
  }

  // Aufgaben mit nur zwei Antworten: Nach einem Fehler wäre der 2. Versuch geschenkt.
  const nurZweiAntworten = (a) => a.typ === 'klappt' || (a.typ === 'auswahl' && a.antworten.length === 2);

  function zeigeAufgabe(a) {
    let versuch = 1;
    let beantwortetSchon = false;
    const rueck = el('div', { class: 'rueck-bereich', 'aria-live': 'polite' });
    zeigenWennNoetig(rueck);
    const darstellung = aufgabeDarstellen(a, (wert) => beantwortet(wert), daten);

    const erklaeren = el('button', { type: 'button', class: 'knopf knopf-leise knopf-breit', onclick: () => {
      // Vor der Antwort: nur die Regel. Nach der Antwort: die Erklärung zu dieser Aufgabe.
      const inhaltText = beantwortetSchon ? a.erklaerung : konzeptHilfe(a);
      fenster(el('div', {},
        !beantwortetSchon ? el('p', { class: 'leise' }, 'So geht es allgemein:') : null,
        el('p', { class: 'fenster-text' }, text(inhaltText)),
        a.bild ? el('img', { src: `bilder/${a.bild}`, alt: '', class: 'erklaer-bild' }) : null,
        el('div', { class: 'zeile-rechts' }, vorlesenKnopf(inhaltText))
      ), { titel: 'Erklär’s mir' });
    } }, icon('i-birne'), 'Erklär’s mir');

    const karte = el('section', { class: 'karte aufgabe' },
      el('div', { class: 'anweisung-zeile' },
        el('p', { class: 'anweisung' }, el('span', { class: 'anweisung-zeichen', 'aria-hidden': 'true' }, a.symbol || '❓'), el('span', {}, text(a.frage))),
        vorlesenKnopf(() => vorleseText(a, typeof darstellung.reihenfolge === 'function' ? darstellung.reihenfolge() : darstellung.reihenfolge))),
      zeitlimit && !wiederholung ? zeitbalken() : null,
      darstellung.wurzel,
      rueck,
      erklaeren);
    ziel.replaceChildren(fortschritt(), karte);
    window.scrollTo(0, 0);

    function beantwortet(wert) {
      const richtig = pruefen(a, wert, daten);
      const endgueltig = richtig || versuch >= 2 || nurZweiAntworten(a);
      if (endgueltig) beantwortetSchon = true;
      darstellung.ergebnis(wert, richtig, endgueltig);
      tonSpielen(richtig);
      if (richtig) {
        clearInterval(zeitgeber);
        let plus = 0;
        if (!wiederholung && art === 'normal') {
          plus = versuch === 1 ? PUNKTE.erster : PUNKTE.zweiter;
          stand.punkte += plus;
        }
        if (!wiederholung && versuch === 1) stand.ersterVersuch += 1;
        let lobText = lob(daten, versuch === 1 ? 'erster' : 'zweiter');
        if (art === 'fehler') {
          const erledigt = fehlerWiederholt(name, a.id, versuch === 1);
          if (erledigt) { stand.ausgebessert += 1; lobText = lob(daten, 'ausgebessert'); }
          else lobText = versuch === 1 ? 'Richtig! Noch einmal richtig, dann ist es erledigt.' : 'Richtig! Das üben wir bald noch einmal.';
        } else if (wiederholung) {
          if (versuch === 1) stand.ausgebessert += 1;
          lobText = lob(daten, 'ausgebessert');
        }
        if (versuch === 1) kannZaehlen(name, a.kann);
        rueck.replaceChildren(rueckmeldung(true, lobText, null, plus));
        weiterKnopf(a);
        return;
      }
      if (!endgueltig) {
        versuch = 2;
        const hinweis = fehlerHinweis(a, wert) || a.denkanstoss;
        const nochmal = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', onclick: () => {
          rueck.replaceChildren();
          darstellung.nochmal();
        } }, 'Nochmal versuchen');
        rueck.replaceChildren(rueckmeldung(false, 'Noch nicht.', hinweis, 0, null, hinweis), nochmal);
        nochmal.focus({ preventScroll: true });
        return;
      }
      clearInterval(zeitgeber);
      if (!wiederholung) stand.falsch.push(a.id);
      if (art === 'normal' && !wiederholung) {
        stand.nochmal.push(a);
        fehlerMerken(name, a, bereich);
      }
      if (art === 'fehler') fehlerWiederholt(name, a.id, false);
      const loesung = loesungsText(a, daten);
      rueck.replaceChildren(rueckmeldung(false, nurZweiAntworten(a) && versuch === 1 ? 'Leider nicht. Merk dir die Lösung.' : 'Das war noch nicht richtig.', null, 0,
        el('div', { class: 'loesung' },
          el('p', {}, el('b', {}, '💡 So geht’s: '), text(loesung)),
          el('p', {}, text(a.erklaerung)),
          art === 'normal' && !wiederholung ? el('p', { class: 'leise' }, '↻ Diese Aufgabe kommt am Ende der Runde noch einmal.') : null),
        `Lösung: ${loesung}. ${a.erklaerung}`));
      weiterKnopf(a);
    }

    function weiterKnopf(aufgabe) {
      const knopfWeiter = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: () => {
        if (!wiederholung) stand.beantwortet += 1;
        index += 1;
        if (mitWarum && !wiederholung && aufgabe.warum && stand.beantwortet % 2 === 0) warumFrage(aufgabe);
        else naechste();
      } }, 'Weiter ➜');
      rueck.append(knopfWeiter);
      knopfWeiter.focus({ preventScroll: true });
    }
  }

  // ★★★: "Warum?" mit drei Begründungen, richtige Begründung = Extrapunkte.
  function warumFrage(aufgabe) {
    const w = { typ: 'auswahl', antworten: aufgabe.warum.antworten, richtig: aufgabe.warum.richtig };
    const rueck = el('div', { class: 'rueck-bereich', 'aria-live': 'polite' });
    zeigenWennNoetig(rueck);
    const darstellung = aufgabeDarstellen(w, (wert) => {
      const richtig = wert === w.richtig;
      darstellung.ergebnis(wert, richtig, true);
      tonSpielen(richtig);
      if (richtig) { stand.punkte += PUNKTE.warum; stand.warumRichtig += 1; }
      rueck.replaceChildren(
        rueckmeldung(richtig, richtig ? 'Gute Begründung!' : 'Diese Begründung passt nicht.', null, richtig ? PUNKTE.warum : 0),
        el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: naechste }, 'Weiter ➜'));
    }, daten);
    const bezug = aufgabe.typ === 'klappt' ? `${aufgabe.oxid} + ${aufgabe.stoff}`
      : aufgabe.typ === 'wortgleichung' ? loesungsText(aufgabe, daten)
        : aufgabe.links ? `${aufgabe.links.join(' + ')} → ${aufgabe.rechts.join(' + ')}` : aufgabe.frage;
    ziel.replaceChildren(el('section', { class: 'karte aufgabe warum' },
      el('p', { class: 'warum-bezug' }, 'Zur Aufgabe: ', el('b', {}, text(bezug))),
      el('div', { class: 'anweisung-zeile' },
        el('p', { class: 'anweisung' }, el('span', { class: 'anweisung-zeichen', 'aria-hidden': 'true' }, '💡'),
          el('span', {}, text(aufgabe.warum.frage || 'Warum?'))),
        vorlesenKnopf(() => vorleseText({ ...w, frage: `${aufgabe.warum.frage || 'Warum?'} Zur Aufgabe: ${bezug}` }, darstellung.reihenfolge))),
      el('p', { class: 'tipp' }, `Extrapunkte: +${PUNKTE.warum} für die richtige Begründung.`),
      darstellung.wurzel, rueck));
  }

  function ende() {
    aufraeumen();
    fertig({
      art, bereich, niveau,
      punkte: stand.punkte,
      ersterVersuch: stand.ersterVersuch,
      anzahl: aufgaben.length,
      warumRichtig: stand.warumRichtig,
      gesehen: [...aufgaben.map((x) => x.id)],
      ausgebessert: stand.ausgebessert,
      falsch: stand.falsch,
      kurs
    });
  }

  naechste();
}

export function rueckmeldung(richtig, titel, hinweis, plus = 0, extra = null, vorleseZusatz = null) {
  return el('div', { class: `rueckmeldung ${richtig ? 'richtig' : 'falsch'}`, role: 'status' },
    el('span', { class: 'marke', 'aria-hidden': 'true' }, richtig ? '✓' : '✗'),
    el('p', { class: 'rueckmeldung-titel' }, el('span', { class: 'nur-vorlesen' }, richtig ? 'Richtig. ' : 'Falsch. '), titel),
    plus > 0 ? el('span', { class: 'punkte-plus breit-rechts' }, `+${plus}`)
      : vorleseZusatz ? el('span', { class: 'breit-rechts' }, vorlesenKnopf(`${titel} ${vorleseZusatz}`)) : null,
    hinweis ? el('div', { class: 'denkanstoss breit' }, el('span', { class: 'denkanstoss-zeichen', 'aria-hidden': 'true' }, '💡'), el('p', {}, text(hinweis))) : null,
    extra ? el('div', { class: 'breit' }, extra) : null);
}
