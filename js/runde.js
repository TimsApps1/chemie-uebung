// Ablauf einer Übungsrunde: 8 Aufgaben, Denkanstoß, 2. Versuch, Lösung, Wiederholung am Ende.
import { el, mischen, sterneText, formelKnoten } from './hilfen.js';
import { kopfSetzen, icon, iconKnopf, text, vorlesenKnopf, vorlesenStoppen, fenster, fragen, tonSpielen } from './ui.js';
import { aufgabeDarstellen, pruefen, fehlerHinweis, loesungsText, vorleseText } from './aufgaben.js';
import { fehlerMerken, fehlerWiederholt, kannZaehlen, geraet, profil, aendern } from './profil.js';

export const RUNDE_LAENGE = 8;
const ZEIT_PRO_AUFGABE = 45; // Sekunden, nur ★★★
const PUNKTE = { erster: 10, zweiter: 5, warum: 5 };

const LOB_STANDARD = {
  erster: ['Richtig!', 'Stimmt genau!', 'Gut gemacht!', 'Sehr gut!'],
  zweiter: ['Beim 2. Versuch richtig – gut nachgedacht!', 'Richtig! Der Denkanstoß hat geholfen.', 'Gut, dass du drangeblieben bist!'],
  ausgebessert: ['Ausgebessert! Diesmal hat es geklappt.', 'Super, jetzt sitzt es!'],
  ausgleichen: ['Die Waage steht gerade – alle Atome passen!', 'Links und rechts gleich viele Atome. Stark!', 'Sauber ausgeglichen!', 'Alle Atome sind wieder da – genau so!']
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
  // „Ist die Gleichung ausgeglichen?“ (Ja/Nein) zählt als eigene Art: höchstens 2 pro Runde, sonst wird zu viel geraten.
  const art = (x) => (x.typ === 'ausgleichen' && x.pruefen ? 'pruefen' : x.typ);
  // Bereich 2: Das Ausgleichen ist die Hauptsache (bis 6 pro Runde), höchstens 1 Auswahlfrage.
  const mitAusgleichen = pool.some((x) => x.typ === 'ausgleichen' && !x.pruefen);
  const grenze = (k) => (mitAusgleichen ? ({ ausgleichen: 6, auswahl: 1, pruefen: 2 }[k] ?? 4) : (k === 'pruefen' ? 2 : 4));
  const passt = (a, liste) => !(a.typ === 'sortieren' && zahl(liste, (x) => x.typ === 'sortieren') >= 2) &&
    !(a.generiert && zahl(liste, (x) => x.generiert) >= 3) &&
    zahl(liste, (x) => art(x) === art(a)) < grenze(art(a));
  for (const a of rest) {
    if (auswahl.length >= RUNDE_LAENGE - einstieg.length) break;
    if (passt(a, [...einstieg, ...auswahl])) auswahl.push(a);
  }
  // Falls zu wenig übrig ist, mit den übrigen auffüllen.
  for (const a of rest) {
    if (auswahl.length >= RUNDE_LAENGE - einstieg.length) break;
    if (!auswahl.includes(a)) auswahl.push(a);
  }
  return [...einstieg, ...abwechselnd(auswahl, einstieg)];
}

// Reihenfolge so mischen, dass höchstens 2 gleiche Aufgabentypen direkt hintereinander kommen.
// Immer den erlaubten Typ nehmen, von dem noch am meisten übrig ist – so bleiben keine Dreierketten am Ende.
function abwechselnd(liste, davor = []) {
  const rest = mischen(liste);
  const aus = [];
  const zweiGleiche = (folge, typ) => folge.length >= 2 && folge[folge.length - 1].typ === typ && folge[folge.length - 2].typ === typ;
  while (rest.length) {
    const bisher = [...davor, ...aus];
    const anzahl = {};
    rest.forEach((a) => { anzahl[a.typ] = (anzahl[a.typ] || 0) + 1; });
    const erlaubt = rest.filter((a) => !zweiGleiche(bisher, a.typ));
    const kandidaten = erlaubt.length ? erlaubt : rest;
    const meiste = Math.max(...kandidaten.map((a) => anzahl[a.typ]));
    const wahl = kandidaten.find((a) => anzahl[a.typ] === meiste);
    aus.push(rest.splice(rest.indexOf(wahl), 1)[0]);
  }
  return aus;
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
    nochmal: [], falsch: [], ausgebessert: 0, abgebrochen: false,
    ergebnisse: [] // Rohdaten je Aufgabe: { id, kann, versuch: 1 | 2 | 0 } (0 = nicht gelöst)
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
    const ja = await fragen('⚠ Runde abbrechen? Dann zählen die Punkte nicht.', 'Ja, abbrechen', 'Weiter üben', { hauptIstNein: true });
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
  function zeitbalken(sekunden = ZEIT_PRO_AUFGABE) {
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
      const rest = Math.max(0, 1 - vergangen / (sekunden * 1000));
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
    if (a.hilfe_vorher === false) return 'Lies die Frage genau und überlege in Ruhe. Nach deiner Antwort bekommst du hier die ganze Erklärung.';
    const kann = daten.bereiche.flatMap((b) => b.ich_kann || []).find((k) => k.id === a.kann);
    if (kann?.hilfe && (!kann.kurs || kurs === 'E')) return kann.hilfe;
    return a.denkanstoss;
  }

  // Aufgaben mit nur zwei Antworten: Nach einem Fehler wäre der 2. Versuch geschenkt.
  const nurZweiAntworten = (a) => a.typ === 'klappt' || (a.typ === 'ausgleichen' && a.pruefen) || ((a.typ === 'auswahl' || a.typ === 'modell') && a.antworten.length === 2);

  function zeigeAufgabe(a) {
    let versuch = 1;
    let beantwortetSchon = false;
    const rueck = el('div', { class: 'rueck-bereich', 'aria-live': 'polite' });
    zeigenWennNoetig(rueck);
    const darstellung = aufgabeDarstellen(a, (wert) => beantwortet(wert), daten, { rundeNiveau: art === 'normal' ? niveau : null });

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
        el('p', { class: 'anweisung' }, el('span', { class: 'anweisung-zeichen', 'aria-hidden': 'true' }, a.symbol || '❓'), el('span', {}, a.hilfe_vorher === false ? formelKnoten(a.frage) : text(a.frage))),
        vorlesenKnopf(() => vorleseText(a, typeof darstellung.reihenfolge === 'function' ? darstellung.reihenfolge() : darstellung.reihenfolge))),
      zeitlimit && !wiederholung ? zeitbalken(a.typ === 'bauen' || (a.typ === 'ausgleichen' && !a.pruefen) ? 90 : ZEIT_PRO_AUFGABE) : null,
      darstellung.wurzel,
      rueck,
      erklaeren);
    ziel.replaceChildren(fortschritt(), karte);
    window.scrollTo(0, 0);

    function beantwortet(wert) {
      const richtig = pruefen(a, wert, daten);
      const endgueltig = richtig || versuch >= 2 || nurZweiAntworten(a);
      if (endgueltig) beantwortetSchon = true;
      if (endgueltig && !wiederholung) stand.ergebnisse.push({ id: a.id, kann: a.kann || null, versuch: richtig ? versuch : 0 });
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
        let lobText = a.typ === 'ausgleichen' && !a.pruefen
          ? (versuch === 1 ? lob(daten, 'ausgleichen') : 'Umgebaut und geschafft – die Waage steht gerade!')
          : lob(daten, versuch === 1 ? 'erster' : 'zweiter');
        if (art === 'fehler') {
          const erledigt = fehlerWiederholt(name, a.id, versuch === 1);
          if (erledigt) { stand.ausgebessert += 1; lobText = lob(daten, 'ausgebessert'); }
          else lobText = versuch === 1 ? 'Richtig! Noch einmal richtig, dann ist es erledigt.' : 'Richtig! Das üben wir bald noch einmal.';
        } else if (wiederholung) {
          if (versuch === 1) stand.ausgebessert += 1;
          lobText = lob(daten, 'ausgebessert');
        }
        // Ich-kann zählt nur echte Erstversuche (nicht die Wiederholung kurz nach der gezeigten Lösung).
        if (versuch === 1 && !wiederholung && art === 'normal') kannZaehlen(name, a.kann);
        // Einmal pro Kind: Hinweis zum Zahlenverhältnis bei Stoffen aus Metall und Nichtmetall (Oxide, Chloride, Sulfide).
        let gutZuWissen = null;
        if (a.typ === 'bauen' && /^(Na|Mg|Al|Zn|Pb|Cu|Fe|Ag)/.test(a.formel) && !profil(name).hinweise?.verhaeltnis) {
          aendern(name, (p) => { p.hinweise = { ...(p.hinweise || {}), verhaeltnis: true }; });
          const satz = 'Gut zu wissen: Die Formel zeigt nur das Zahlenverhältnis. In Wirklichkeit hängen sehr viele Atome zusammen.';
          gutZuWissen = el('div', { class: 'gut-zu-wissen' }, el('p', {}, '💡 ', text(satz)), vorlesenKnopf(satz));
        }
        // Alltagsbezug (optional in den Daten): ein Satz, woher man den Stoff kennt.
        const alltag = a.alltag ? el('div', { class: 'gut-zu-wissen' }, el('p', {}, '🌍 ', text(a.alltag)), vorlesenKnopf(a.alltag, 'Satz vorlesen')) : null;
        rueck.replaceChildren(rueckmeldung(true, lobText, null, plus, alltag || gutZuWissen ? [alltag, gutZuWissen].filter(Boolean) : null));
        weiterKnopf(a, true);
        return;
      }
      if (!endgueltig) {
        versuch = 2;
        const hinweis = fehlerHinweis(a, wert) || a.denkanstoss;
        const nochmal = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', onclick: () => {
          rueck.replaceChildren();
          darstellung.nochmal(hinweis);
          // Fokus auf das erste wieder bedienbare Element (VoiceOver, Tastatur, Schaltersteuerung).
          (darstellung.wurzel.querySelector('.bau-stein-knopf') || darstellung.wurzel.querySelector('button:not([disabled]), [role="button"]'))?.focus();
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
      weiterKnopf(a, false);
    }

    // Die Warum-Frage kommt nur nach richtig gelösten Aufgaben (sonst passt sie inhaltlich nicht).
    function weiterKnopf(aufgabe, geloest) {
      const knopfWeiter = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: () => {
        if (!wiederholung) stand.beantwortet += 1;
        index += 1;
        if (mitWarum && geloest && !wiederholung && aufgabe.warum && stand.beantwortet % 2 === 0) warumFrage(aufgabe);
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
        rueckmeldung(richtig, richtig ? 'Gute Begründung!' : 'Diese Begründung passt nicht.', null, richtig ? PUNKTE.warum : 0,
          richtig ? null : el('div', { class: 'loesung' }, el('p', {}, el('b', {}, '💡 Richtig ist: '), text(w.richtig)), el('p', {}, text(aufgabe.erklaerung))),
          richtig ? null : `Richtig ist: ${w.richtig} ${aufgabe.erklaerung}`),
        el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: naechste }, 'Weiter ➜'));
    }, daten);
    const bezug = aufgabe.typ === 'klappt' ? `${aufgabe.oxid} + ${aufgabe.stoff}`
      : aufgabe.typ === 'wortgleichung' ? loesungsText(aufgabe, daten)
        : aufgabe.links ? `${aufgabe.links.join(' + ')} → ${aufgabe.rechts.join(' + ')}` : aufgabe.frage;
    ziel.replaceChildren(el('div', { class: 'fortschritt' }, el('span', { class: 'fortschritt-text' }, `Extrafrage nach Aufgabe ${index} von ${aufgaben.length}`)),
      el('section', { class: 'karte aufgabe warum' },
      el('p', { class: 'warum-bezug' }, 'Zur Aufgabe: ', el('b', {}, text(bezug))),
      el('div', { class: 'anweisung-zeile' },
        el('p', { class: 'anweisung' }, el('span', { class: 'anweisung-zeichen', 'aria-hidden': 'true' }, '💡'),
          el('span', {}, formelKnoten(aufgabe.warum.frage || 'Warum?'))),
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
      ergebnisse: stand.ergebnisse,
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
