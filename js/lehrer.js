// Lehrer-Ansicht, Etappe 2: Ergebnisse einlesen, Übersicht, Beamer, Klassenliste, Sicherung.
import { el, sterneText, datumVonTag } from './hilfen.js';
import { fenster, fragen } from './ui.js';
import {
  lehrerDaten, einlesen, klasseAusText, klasseSpeichern, aliasSetzen, nichtZugeordnet, vorschlaege, kindName,
  rundenNachKind, uebersicht, verlauf, gespielteNiveaus, gruppeVerwerfen, zuordnungen, bestenliste, aktuelleWoche, wochenText, csvRunden, csvUebersicht,
  sicherungErstellen, sicherungGespeichert, sicherungEinlesen, sicherungFaellig, allesLoeschen, rundeLoeschen, ERINNERUNG_TAGE,
  halbjahresBeginn, lehrerBereiche, BEREICH_KURZ, NUR_E,
  amMeistenVerbessert, teamWerte, teamsSetzen, teamsAusText, teamsAlsText, teamVorschlag, klassenzielSetzen, klassenStand
} from './lehrer-daten.js';
import { qrScannen } from './qr.js';
import { sperreAussetzen } from './admin.js';

const BEREICHE = [['B4', 'Symbole und Formeln lesen'], ['B3', 'Reaktivitätsreihe und Redox'], ['B1', 'Formeln bauen'], ['B2', 'Reaktionen ausgleichen']];
const bereichTitel = (id) => BEREICHE.find(([b]) => b === id)?.[1] || id;

function karte(titel, ...inhalt) {
  return el('section', { class: 'karte admin-abschnitt' }, titel ? el('h3', {}, titel) : null, ...inhalt);
}

// Datei speichern: auf dem iPad über "Teilen" (Dateien, AirDrop, Mail), sonst als Download.
async function dateiSpeichern(name, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  try {
    const datei = new File([blob], name, { type: typ });
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: name });
      return true;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false;
  }
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}

const heute = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- Erinnerung an die Sicherung ----------

export function sicherungsHinweis(zurSicherung) {
  if (!sicherungFaellig()) return null;
  return el('div', { class: 'fehler-kasten zeile' },
    el('span', {}, `💾 Seit mehr als ${ERINNERUNG_TAGE} Tagen keine Sicherung. Bitte sichere deine Ergebnisse.`),
    el('button', { type: 'button', class: 'knopf knopf-klein', onclick: zurSicherung }, 'Jetzt sichern'));
}

// ---------- Reiter: Ergebnisse einlesen ----------

function berichtKnoten(bericht) {
  const teile = [];
  if (bericht.speicherVoll) {
    return el('div', { class: 'bericht', role: 'status' }, el('p', { class: 'fehler-kasten' },
      '✗ Der Speicher auf diesem iPad ist voll. Es wurde nichts gespeichert. Sichere deine Daten (💾) und lösche alte Ergebnisse.'));
  }
  teile.push(el('p', { class: bericht.neu.length ? 'vergleich' : 'leise' },
    bericht.neu.length ? `✓ ${bericht.neu.length} ${bericht.neu.length === 1 ? 'Runde' : 'Runden'} neu eingelesen` : 'Keine neuen Runden gefunden.'));
  if (bericht.doppelt.length) teile.push(el('p', { class: 'leise' }, `${bericht.doppelt.length} schon vorhanden (doppelt, ignoriert).`));
  if (bericht.geloescht.length) teile.push(el('p', { class: 'leise' }, `${bericht.geloescht.length} hattest du gelöscht (ignoriert).`));
  if (bericht.ungueltig.length) {
    teile.push(el('div', { class: 'fehler-kasten' },
      el('p', {}, el('b', {}, `✗ ${bericht.ungueltig.length} ungültig:`)),
      el('ul', {}, bericht.ungueltig.map((u) => el('li', {}, el('code', {}, u.code), ` – ${u.grund}`)))));
  }
  return el('div', { class: 'bericht', role: 'status' }, teile);
}

export function ergebnisseReiter({ neu }) {
  const d = lehrerDaten();
  const feld = el('textarea', { class: 'eingabe textfeld', rows: 6, placeholder: 'Hier den Text aus Classroom einfügen (ganze Seite geht auch) …', 'aria-label': 'Text mit Punktecodes' });
  const ausgabe = el('div', { 'aria-live': 'polite' });
  const einlesenKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
    const bericht = einlesen(feld.value, 'text');
    ausgabe.replaceChildren(berichtKnoten(bericht));
    if (bericht.neu.length) { feld.value = ''; setTimeout(neu, 1600); }
  } }, 'Codes einlesen');

  const scanKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross', onclick: () => {
    // Beim Scannen hält die Lehrkraft das iPad nur hin – solange sperrt sich nichts.
    sperreAussetzen(true);
    qrScannen((text) => {
      const bericht = einlesen(text, 'qr');
      const name = bericht.neu[0] ? bericht.neu[0].name : bericht.doppelt[0]?.split('-')[0] || '';
      const seite = (text.match(/^CHEMIE1 (\d+\/\d+)/) || [])[1];
      if (bericht.speicherVoll) return '✗ Speicher voll – nichts gespeichert!';
      return `${bericht.ungueltig.length && !bericht.neu.length ? '✗' : bericht.neu.length ? '✓' : '•'} ${name}${seite ? ` (QR ${seite})` : ''}: ${bericht.neu.length} neu` +
        (bericht.doppelt.length ? `, ${bericht.doppelt.length} schon da` : '') + (bericht.ungueltig.length ? `, ${bericht.ungueltig.length} ungültig` : '');
    }).then(() => {
      // Nach dem Schließen die Ansicht auffrischen.
      const warte = setInterval(() => { if (!document.querySelector('.scan-box')) { clearInterval(warte); sperreAussetzen(false); neu(); } }, 500);
    });
  } }, '📷 QR-Codes scannen');

  const offen = nichtZugeordnet(d);
  const zuordnen = d.klasse.length && offen.length ? karte(`⚠ Nicht zugeordnet (${offen.length})`,
    el('p', { class: 'leise' }, 'Diese Namen passen nicht genau zur Klassenliste (z. B. anders geschrieben). Tippe auf das richtige Kind.'),
    el('ul', { class: 'zuordnen-liste' }, offen.map(({ schluessel, runden }) => {
      const [kurz, kennung] = schluessel.split('|');
      const auswahl = el('select', { class: 'eingabe auswahl-klein', 'aria-label': `Kind für ${kurz} wählen` },
        el('option', { value: '' }, 'Anderes Kind …'),
        d.klasse.map((k) => el('option', { value: k.id }, k.anzeige)));
      const zuordnen = async (kindId) => {
        const kind = d.klasse.find((k) => k.id === kindId);
        const details = runden.map((r) => `${datumVonTag(r.tag)} ${r.bereich} ${sterneText(r.niveau)} ${r.punkte} P.`).slice(0, 6).join(', ');
        if (await fragen(`${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'} von „${kurz}“ (${details}${runden.length > 6 ? ' …' : ''}) dem Kind „${kind.anzeige}“ zuordnen? Im Reiter 👥 Klasse kannst du das wieder aufheben.`,
          'Ja, zuordnen', 'Abbrechen', { hauptIstNein: true })) { aliasSetzen(schluessel, kindId); neu(); }
      };
      auswahl.addEventListener('change', () => { if (auswahl.value) zuordnen(auswahl.value); });
      return el('li', {},
        el('p', {}, el('b', {}, kurz), kennung ? el('span', { class: 'leise' }, ` (Kennung ${kennung})`) : null, ` · ${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'}, zuletzt ${datumVonTag(runden[runden.length - 1].tag)}`),
        el('div', { class: 'zeile' },
          vorschlaege(d, schluessel).slice(0, 3).map((k) => el('button', { type: 'button', class: 'knopf knopf-klein', onclick: () => zuordnen(k.id) }, `→ ${k.anzeige}`)),
          auswahl,
          el('button', { type: 'button', class: 'knopf knopf-klein', onclick: async () => {
            if (await fragen(`Alle ${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'} von „${kurz}“ verwerfen (z. B. Testname oder Kind nicht mehr in der Klasse)? Sie kommen auch beim nächsten Einlesen nicht zurück.`,
              'Ja, verwerfen', 'Abbrechen', { hauptIstNein: true })) { gruppeVerwerfen(schluessel); neu(); }
          } }, '🗑 Verwerfen')));
    }))) : null;

  const letzte = [...d.runden].sort((a, b) => b.eingelesen - a.eingelesen).slice(0, 8);
  return [
    karte('Ergebnisse einsammeln',
      el('p', { class: 'leise' }, 'In der Stunde: Jedes Kind tippt auf „📷 Ergebnisse zeigen“, du scannst den QR-Code. Doppelte Runden werden automatisch ignoriert.'),
      scanKnopf,
      el('h4', {}, 'Oder: Text aus Classroom einfügen'),
      el('p', { class: 'leise' }, 'Kopiere die Kommentare mit den Punktecodes (oder die ganze Seite) und füge sie hier ein. Die App findet die Codes selbst.'),
      feld, einlesenKnopf, ausgabe),
    zuordnen,
    !d.klasse.length && d.runden.length ? karte(null, el('p', { class: 'leise' }, '💡 Tipp: Trage im Reiter „👥 Klasse“ deine Klassenliste ein. Dann erscheinen die vollen Namen, und anders geschriebene Namen kannst du zuordnen.')) : null,
    karte(`Zuletzt eingelesen (${d.runden.length} Runden insgesamt)`,
      letzte.length ? el('ul', { class: 'code-liste' }, letzte.map((r) => el('li', {},
        el('span', { class: 'code-info' }, `${datumVonTag(r.tag)} · ${r.bereich} ${sterneText(r.niveau)} · ${r.punkte} Punkte${r.erster !== null && r.erster !== undefined ? ` · ${r.erster}/8 beim 1. Versuch` : ''} · ${r.quelle === 'qr' ? '📷' : '📋'}`),
        el('span', { class: 'code' }, r.code)))) : el('p', { class: 'leise' }, 'Noch nichts eingelesen.'))
  ].filter(Boolean);
}

// ---------- Reiter: Übersicht pro Kind ----------

function kindDetail(id, neu) {
  const d = lehrerDaten();
  const runden = rundenNachKind(d).get(id) || [];
  const kombis = gespielteNiveaus(runden);
  let wahl = kombis[0] || null;
  const verlaufBox = el('div', { class: 'verlauf-box' });
  const zeigeVerlauf = () => {
    if (!wahl) { verlaufBox.replaceChildren(el('p', { class: 'leise' }, 'Noch keine Runden.')); return; }
    const v = verlauf(runden, { ...wahl, wochen: 8 });
    const max = wahl.niveau === 3 && wahl.bereich === 'B3' ? 100 : 80;
    verlaufBox.replaceChildren(
      el('div', { class: 'zeile', role: 'radiogroup', 'aria-label': 'Bereich und Niveau' }, kombis.map((k) =>
        el('button', { type: 'button', class: 'knopf knopf-klein' + (k === wahl ? ' knopf-haupt' : ''), role: 'radio', 'aria-checked': String(k === wahl),
          onclick: () => { wahl = k; zeigeVerlauf(); } }, `${k.bereich} ${sterneText(k.niveau)}`))),
      el('ol', { class: 'saeulen wochen-saeulen', 'aria-label': 'Bestwert pro Woche: ' + v.map((w) => w.best ?? 'keine Runde').join(', ') },
        v.map((w) => el('li', { style: `--h:${w.best === null ? 0 : Math.max(3, (w.best / max) * 100)}%`, class: w.best === null ? 'leer' : '' },
          el('span', { class: 'saeule' }),
          el('small', {}, w.best === null ? '–' : String(w.best)),
          el('small', { class: 'saeule-niveau' }, w.runden ? `${w.runden}× · ${w.ersterQuote ?? '–'} %` : ''),
          el('small', { class: 'saeule-niveau' }, datumVonTag(w.woche * 7 - 4).slice(0, 6))))),
      el('p', { class: 'tipp' }, `Säule = Bestwert der Woche (von ${max}). Darunter: Zahl der Runden · % beim 1. Versuch richtig.`));
  };
  zeigeVerlauf();
  const tabelle = el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle' },
    el('thead', {}, el('tr', {}, ['Datum', 'Bereich', 'Niveau', 'Kurs', 'Punkte', '1. Versuch', 'Begr.', ''].map((t) => el('th', {}, t)))),
    el('tbody', {}, [...runden].reverse().map((r) => el('tr', {},
      el('td', {}, datumVonTag(r.tag)), el('td', {}, r.bereich), el('td', {}, sterneText(r.niveau)), el('td', {}, r.kurs || '–'),
      el('td', {}, String(r.punkte)), el('td', {}, r.erster !== null && r.erster !== undefined ? `${r.erster}/8` : '–'), el('td', {}, r.warum ? String(r.warum) : '–'),
      el('td', {}, el('button', { type: 'button', class: 'knopf knopf-klein', 'aria-label': `Runde vom ${datumVonTag(r.tag)} löschen`, onclick: async () => {
        if (await fragen(`Diese Runde (${datumVonTag(r.tag)}, ${r.punkte} Punkte) löschen? Sie kommt auch beim nächsten Einlesen nicht zurück.`, 'Ja, löschen', 'Abbrechen', { hauptIstNein: true })) {
          rundeLoeschen(r.code);
          zuDetail?.();
          neu();
        }
      } }, '🗑')))))));
  const zuDetail = fenster(el('div', { class: 'kind-detail' },
    el('h4', {}, 'Lernverlauf (letzte 8 Wochen)'),
    verlaufBox,
    el('h4', {}, `Alle Runden (${runden.length})`),
    runden.length ? tabelle : el('p', { class: 'leise' }, 'Noch keine Runden.')), { titel: kindName(d, id) });
}

let zeitraum = 'alles';

export function uebersichtReiter({ neu }) {
  const d = lehrerDaten();
  const abTag = zeitraum === 'halbjahr' ? halbjahresBeginn() : zeitraum === 'vier' ? aktuelleWoche() * 7 - 4 - 21 : null;
  const liste = uebersicht(d, { abTag });
  const zeitWahl = el('div', { class: 'zeile', role: 'radiogroup', 'aria-label': 'Zeitraum' },
    [['alles', 'Alles'], ['halbjahr', `Dieses Halbjahr (ab ${datumVonTag(halbjahresBeginn())})`], ['vier', 'Letzte 4 Wochen']].map(([wert, titel]) =>
      el('button', { type: 'button', class: 'knopf knopf-klein' + (zeitraum === wert ? ' knopf-haupt' : ''), role: 'radio', 'aria-checked': String(zeitraum === wert),
        onclick: () => { zeitraum = wert; neu(); } }, titel)));
  const zelle = (k, b) => {
    const x = k.proBereich[b];
    if (!x) return el('td', { class: 'leise' }, '–');
    return el('td', {}, [1, 2, 3].map((n) => {
      const w = x.proNiveau[n];
      return w ? el('div', { class: 'ueb-niveau' }, el('span', { class: 'sterne' }, sterneText(n)),
        ` ${w.best} (Ø ${w.schnitt}${w.ersterQuote !== null ? `, ${w.ersterQuote} %` : ''}) · ${w.runden}×`) : null;
    }), x.kurs ? el('div', { class: 'leise klein' }, `Kurs ${x.kurs}`) : null);
  };
  const meldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  return [
    karte('Übersicht pro Kind',
      el('p', { class: 'leise' }, 'Pro Niveau: Bestwert (Ø Durchschnitt, % der Aufgaben beim 1. Versuch richtig) · Zahl der Runden. Tippe auf einen Namen für alle Runden und den Verlauf. Bei B1 (Bauen) zählt das erste fertig gebaute Modell (alle Noppen belegt) als 1. Versuch. Bei B2 ★/★★ hilft die Waage live mit; was ein Kind ohne Hilfe kann, zeigt B2 ★★★ (Waage verdeckt).'),
      zeitWahl,
      liste.length ? el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle uebersicht-tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Runden'), lehrerBereiche(d).map((b) => el('th', {}, BEREICH_KURZ[b])), el('th', {}, 'Zuletzt'))),
        el('tbody', {}, liste.map((k) => el('tr', { class: k.runden ? '' : 'leise' },
          el('th', { scope: 'row' }, el('button', { type: 'button', class: 'name-knopf', onclick: () => kindDetail(k.id, neu) }, k.name)),
          el('td', {}, `${k.runden}`, el('div', { class: 'leise klein' }, `diese Woche ${k.dieseWoche}`)),
          lehrerBereiche(d).map((b) => zelle(k, b)),
          el('td', {}, k.letzterTag !== null ? datumVonTag(k.letzterTag) : '–'))))))
        : el('p', { class: 'leise' }, 'Noch keine Ergebnisse. Lies im Reiter „📥 Ergebnisse“ Codes ein.')),
    karte('Als Tabelle speichern',
      el('p', { class: 'leise' }, 'Die Tabellen öffnen sich in Numbers oder Excel. Auf dem iPad wählst du danach „In Dateien sichern“ oder schickst sie dir per Mail.'),
      el('div', { class: 'zeile' },
        el('button', { type: 'button', class: 'knopf', onclick: async () => { await dateiSpeichern(`chemie-alle-runden-${heute()}.csv`, csvRunden(d), 'text/csv'); meldung.textContent = '✓'; } }, '📄 Alle Runden'),
        el('button', { type: 'button', class: 'knopf', onclick: async () => { await dateiSpeichern(`chemie-uebersicht-${heute()}.csv`, csvUebersicht(d, { abTag }), 'text/csv'); meldung.textContent = '✓'; } }, '📄 Übersicht pro Kind'),
        meldung))
  ];
}

// ---------- Reiter: Beamer ----------

let beamerWahl = { ansicht: 'beste', bereich: 'B3', niveau: 1, woche: null, kurs: '' };

const ANSICHTEN = [['beste', '🏆 Die besten 5'], ['verbessert', '📈 Am meisten verbessert'], ['teams', '👥 Teams'], ['ziel', '🎯 Klassenziel']];

// Inhalt der Beamer-Ansicht (auch als Vorschau im Reiter genutzt).
function beamerInhalt(d, woche, fuerLehrkraft = false) {
  const w = beamerWahl;
  if (w.ansicht === 'verbessert') {
    const liste = amMeistenVerbessert(d, { ...w, woche });
    return {
      titel: '📈 Am meisten verbessert',
      untertitel: `${bereichTitel(w.bereich)} · ${sterneText(w.niveau)}${w.kurs ? ` · ${w.kurs}-Kurs` : ''}`,
      satz: `Woche ${wochenText(woche)} · Bestwert dieser Woche gegen den eigenen Bestwert der Wochen davor (ab 2 Runden)`,
      knoten: liste.length ? el('ol', { class: 'rangliste' }, liste.map((x) => el('li', { class: 'rang' },
        el('span', { class: `rang-platz platz-${x.platz}` }, String(x.platz)),
        el('span', { class: 'rang-name' }, x.name),
        el('span', { class: 'rang-punkte' }, `+${x.plus}`))))
        : liste.rest ? null : el('p', { class: 'beamer-leer' }, 'Diese Woche hat sich hier noch niemand verbessert. Das kommt noch!'),
      rest: liste.rest ? `${liste.length ? '… und' : ''} ${liste.rest.anzahl} ${liste.length ? 'weitere' : 'Kinder'} mit +${liste.rest.plus} – stark!` : null
    };
  }
  if (w.ansicht === 'teams') {
    const alle = teamWerte(d, { woche });
    // Auf dem Beamer nur Teams mit Punkten in der Rangliste; Teams ohne Punkte stehen neutral darunter.
    const teams = fuerLehrkraft ? alle : alle.filter((t) => t.wert > 0);
    const starten = fuerLehrkraft ? [] : alle.filter((t) => t.wert === 0);
    return {
      titel: '👥 Teams',
      untertitel: 'Teamwert = Durchschnitt aller Mitglieder',
      satz: `Woche ${wochenText(woche)} · pro Kind die 3 besten Runden der Woche (alle Bereiche)`,
      knoten: !alle.length ? el('p', { class: 'beamer-leer' }, 'Noch keine Teams angelegt.')
        : !teams.length ? el('p', { class: 'beamer-leer' }, 'Diese Woche geht’s los – noch hat kein Team Punkte.')
          : el('ol', { class: 'rangliste' }, teams.map((t) => el('li', { class: 'rang' },
            // Gleicher Teamwert = gleicher Platz; Medaillenfarbe nur mit Punkten.
            el('span', { class: `rang-platz${t.wert > 0 ? ` platz-${t.platz}` : ''}` }, String(t.platz)),
            // Wie viele geübt haben, sieht nur die Lehrkraft (niemand bloßstellen).
            el('span', { class: 'rang-name' }, t.name, fuerLehrkraft ? el('small', { class: 'rang-info' }, ` ${t.aktiv} von ${t.mitglieder} haben geübt`) : null),
            el('span', { class: 'rang-punkte' }, String(t.wert))))),
      rest: starten.length ? `Startet noch: ${starten.map((t) => t.name).join(', ')}` : null
    };
  }
  if (w.ansicht === 'ziel') {
    const k = klassenStand(d, { woche });
    return {
      titel: '🎯 Klassenziel',
      untertitel: 'Alle Punkte der Klasse zusammen',
      satz: `Woche ${wochenText(woche)}`,
      knoten: el('div', { class: 'klassenziel' },
        el('div', { class: 'klassenziel-balken', role: 'img', 'aria-label': `${k.summe} von ${k.ziel} Punkten` },
          el('span', { style: `width:${Math.round(k.anteil * 100)}%` })),
        el('p', { class: 'klassenziel-zahl' }, `${k.summe} von ${k.ziel} Punkten`, k.summe >= k.ziel ? ' – geschafft! 🎉' : '')),
      rest: null
    };
  }
  const liste = bestenliste(d, { ...w, woche });
  return {
    titel: '🏆 Die besten 5',
    untertitel: `${bereichTitel(w.bereich)} · ${sterneText(w.niveau)}${w.kurs ? ` · ${w.kurs}-Kurs` : ''}`,
    satz: `Woche ${wochenText(woche)} · Wochenwert = die 3 besten Runden`,
    knoten: liste.length ? el('ol', { class: 'rangliste' }, liste.map((x) => el('li', { class: 'rang' },
      el('span', { class: `rang-platz platz-${x.platz}` }, String(x.platz)),
      el('span', { class: 'rang-name' }, x.name),
      el('span', { class: 'rang-punkte' }, String(x.wert)))))
      : liste.rest ? null : el('p', { class: 'beamer-leer' }, 'Diese Woche gibt es hier noch keine Runden.'),
    rest: liste.rest ? (liste.length ? `… und ${liste.rest.anzahl} weitere mit ${liste.rest.wert} Punkten – stark!` : `${liste.rest.anzahl} Kinder gleichauf mit ${liste.rest.wert} Punkten – stark!`) : null
  };
}

function beamerAnsicht() {
  const d = lehrerDaten();
  const woche = beamerWahl.woche ?? aktuelleWoche();
  const inhalt = beamerInhalt(d, woche);
  sperreAussetzen(true);
  const schliessen = () => { sperreAussetzen(false); flaeche.remove(); };
  const mitNiveau = beamerWahl.ansicht === 'beste' || beamerWahl.ansicht === 'verbessert';
  const flaeche = el('div', { class: 'beamer-flaeche', role: 'dialog', 'aria-label': 'Beamer-Ansicht' },
    el('div', { class: 'beamer' },
      el('div', { class: 'beamer-kopf' },
        el('span', { class: 'beamer-titel' }, inhalt.titel),
        el('span', { class: 'beamer-bereich' }, inhalt.untertitel),
        el('button', { type: 'button', class: 'knopf beamer-zu', onclick: schliessen, 'aria-label': 'Beamer-Ansicht schließen' }, '✕')),
      el('p', { class: 'beamer-woche' }, inhalt.satz),
      inhalt.knoten,
      inhalt.rest ? el('p', { class: 'beamer-woche' }, inhalt.rest) : null,
      el('div', { class: 'beamer-umschalten' },
        ANSICHTEN.map(([a, t]) => el('button', { type: 'button', class: 'knopf' + (a === beamerWahl.ansicht ? ' knopf-haupt' : ''),
          onclick: () => { beamerWahl.ansicht = a; flaeche.remove(); beamerAnsicht(); } }, t)),
        mitNiveau ? [1, 2, 3].map((n) => el('button', { type: 'button', class: 'knopf' + (n === beamerWahl.niveau ? ' knopf-haupt' : ''),
          'aria-label': ['', 'ein Stern', 'zwei Sterne', 'drei Sterne'][n], 'aria-pressed': String(n === beamerWahl.niveau),
          onclick: () => { beamerWahl.niveau = n; flaeche.remove(); beamerAnsicht(); } }, sterneText(n))) : null)));
  // Beamer-Fläche: Fokus hinein, Escape schließt.
  flaeche.setAttribute('aria-modal', 'true');
  flaeche.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliessen(); });
  flaeche.querySelector('.beamer-zu')?.focus();
  document.body.append(flaeche);
  flaeche.querySelector('.beamer-zu')?.focus();
}

function teamsKarte(neu) {
  const d = lehrerDaten();
  const feld = el('textarea', { class: 'eingabe textfeld', rows: 6, 'aria-label': 'Teams',
    placeholder: 'Ein Team pro Zeile, z. B.\nTeam Rot: Lena Schmidt, Jonas Becker\nTeam Blau: Elif Yilmaz, Tom Berg' });
  feld.value = teamsAlsText(d);
  const vorschau = el('div', { 'aria-live': 'polite' });
  const anzahl = el('select', { class: 'eingabe auswahl-feld', 'aria-label': 'Zahl der Teams' },
    [2, 3, 4, 5, 6, 7, 8].map((n) => el('option', { value: n, selected: n === 4 }, `${n} Teams`)));
  const zeigeVorschau = () => {
    const { teams, unbekannt, mehrdeutig } = teamsAusText(feld.value, d.klasse);
    const zaehl = new Map();
    teams.forEach((t) => t.mitglieder.forEach((id) => zaehl.set(id, (zaehl.get(id) || 0) + 1)));
    const mehrfach = [...zaehl].filter(([, n]) => n > 1).map(([id]) => kindName(d, id));
    const ohneTeam = d.klasse.filter((k) => !zaehl.has(k.id)).map((k) => k.anzeige);
    const weg = (d.teams || []).flatMap((t) => t.mitglieder).filter((id) => !d.klasse.some((k) => k.id === id));
    // Nur echte Knoten einfügen (null würde als Text „null“ erscheinen).
    vorschau.replaceChildren(...[
      teams.length ? el('ul', { class: 'vorschau-liste' }, teams.map((t) => el('li', {}, `${t.name}: ${t.mitglieder.length} ${t.mitglieder.length === 1 ? 'Kind' : 'Kinder'}`))) : null,
      unbekannt.length ? el('p', { class: 'meldung' }, `⚠ Nicht in der Klassenliste: ${unbekannt.join(', ')}`) : null,
      mehrfach.length ? el('p', { class: 'meldung' }, `⚠ In mehreren Teams: ${mehrfach.join(', ')}`) : null,
      mehrdeutig.length ? el('p', { class: 'meldung' }, `⚠ Nicht eindeutig – bitte den vollen Namen schreiben: ${mehrdeutig.join(', ')}`) : null,
      weg.length ? el('p', { class: 'meldung' }, `⚠ ${weg.length} ${weg.length === 1 ? 'Kind ist' : 'Kinder sind'} nicht mehr in der Klassenliste und ${weg.length === 1 ? 'zählt' : 'zählen'} nicht mehr mit. Bitte Teams prüfen und speichern.`) : null,
      teams.length && ohneTeam.length ? el('p', { class: 'leise' }, `Ohne Team: ${ohneTeam.join(', ')}`) : null
    ].filter(Boolean));
  };
  feld.addEventListener('input', zeigeVorschau);
  zeigeVorschau();
  const meldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  return karte('Teams anlegen',
    el('p', { class: 'leise' }, 'Ein Team pro Zeile: Teamname, Doppelpunkt, Namen mit Komma. Teamwert = Durchschnitt, nicht Summe – große Teams sind nicht im Vorteil.'),
    d.klasse.length ? el('div', { class: 'zeile' }, anzahl,
      el('button', { type: 'button', class: 'knopf', onclick: () => {
        feld.value = teamsAlsText({ ...d, teams: teamVorschlag(d, Number(anzahl.value)) });
        zeigeVorschau();
      } }, '🔀 Gemischte Teams vorschlagen')) : el('p', { class: 'meldung' }, 'Lege zuerst im Reiter „👥 Klasse“ die Klassenliste an.'),
    feld, vorschau,
    el('div', { class: 'zeile' }, el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
      teamsSetzen(teamsAusText(feld.value, d.klasse).teams);
      meldung.textContent = '✓ Gespeichert';
      setTimeout(neu, 700);
    } }, 'Teams speichern'), meldung));
}

function zielKarte(neu) {
  const d = lehrerDaten();
  const k = klassenStand(d, { woche: aktuelleWoche() });
  const feld = el('input', { type: 'number', class: 'eingabe', min: 100, step: 100, value: k.ziel, inputmode: 'numeric', 'aria-label': 'Klassenziel in Punkten pro Woche' });
  const meldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  return karte('Klassenziel einstellen',
    el('p', { class: 'leise' }, k.eingestellt ? 'Punkte, die die ganze Klasse in einer Woche zusammen schaffen soll.'
      : `Noch nicht eingestellt. Vorschlag: ${k.ziel} Punkte pro Woche (150 pro Kind).`),
    el('div', { class: 'zeile' }, feld, el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
      const ziel = Number(feld.value);
      if (!(ziel >= 100)) { meldung.textContent = '⚠ Bitte eine Zahl ab 100 eingeben.'; return; }
      klassenzielSetzen(ziel);
      meldung.textContent = '✓ Gespeichert';
      setTimeout(neu, 700);
    } }, 'Ziel speichern'), meldung));
}

export function beamerReiter({ neu }) {
  const woche = beamerWahl.woche ?? aktuelleWoche();
  const wahl = (feld, wert, text) => el('button', { type: 'button', class: 'knopf' + (beamerWahl[feld] === wert ? ' knopf-haupt' : ''),
    onclick: () => { beamerWahl[feld] = wert; if (feld === 'bereich' && NUR_E.includes(wert)) beamerWahl.kurs = ''; neu(); } }, text);
  const d = lehrerDaten();
  const inhalt = beamerInhalt(d, woche, true);
  const mitNiveau = beamerWahl.ansicht === 'beste' || beamerWahl.ansicht === 'verbessert';
  return [karte('Rangliste für den Beamer',
    el('p', { class: 'leise' }, 'Gezeigt werden nur die Besten, die am meisten Verbesserten (höchstens 5), Teams oder das Klassenziel. Niemand wird vorgeführt.'),
    el('h4', {}, 'Was zeigen?'), el('div', { class: 'zeile' }, ANSICHTEN.map(([a, t]) => wahl('ansicht', a, t))),
    mitNiveau ? [
      el('h4', {}, 'Bereich'), el('div', { class: 'zeile' }, lehrerBereiche().map((b) => wahl('bereich', b, BEREICH_KURZ[b]))),
      el('h4', {}, 'Niveau'), el('div', { class: 'zeile' }, [1, 2, 3].map((n) => wahl('niveau', n, sterneText(n)))),
      NUR_E.includes(beamerWahl.bereich) ? el('p', { class: 'leise' }, 'Diesen Bereich übt nur der E-Kurs.')
        : [el('h4', {}, 'Kurs'), el('div', { class: 'zeile' }, wahl('kurs', '', 'Alle'), wahl('kurs', 'G', 'G-Kurs'), wahl('kurs', 'E', 'E-Kurs'))]].flat() : null,
    el('h4', {}, 'Woche'),
    el('div', { class: 'zeile' },
      el('button', { type: 'button', class: 'knopf', 'aria-label': 'Woche davor', onclick: () => { beamerWahl.woche = woche - 1; neu(); } }, '◀'),
      el('span', { class: 'woche-text' }, wochenText(woche), woche === aktuelleWoche() ? ' (diese Woche)' : ''),
      el('button', { type: 'button', class: 'knopf', 'aria-label': 'Woche danach', disabled: woche >= aktuelleWoche(), onclick: () => { beamerWahl.woche = woche + 1; neu(); } }, '▶')),
    el('h4', {}, 'Vorschau'),
    beamerWahl.ansicht === 'beste' ? (() => {
      const vorschau = bestenliste(d, { ...beamerWahl, woche });
      return vorschau.length || vorschau.rest ? el('ul', { class: 'vorschau-liste' }, vorschau.map((w) => el('li', {}, `${w.platz}. ${w.name} – ${w.wert} (${w.runden} ${w.runden === 1 ? 'Runde' : 'Runden'})`)),
        vorschau.rest ? el('li', { class: 'leise' }, `… und ${vorschau.rest.anzahl} weitere mit ${vorschau.rest.wert} Punkten (Gleichstand, ohne Namen)`) : null)
        : el('p', { class: 'leise' }, 'Für diese Auswahl gibt es noch keine Runden.');
    })() : el('div', { class: 'beamer-vorschau' }, el('p', { class: 'leise' }, inhalt.satz), inhalt.knoten, inhalt.rest ? el('p', { class: 'leise' }, inhalt.rest) : null),
    el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross', onclick: beamerAnsicht }, '🖥 Beamer-Ansicht öffnen')),
  beamerWahl.ansicht === 'teams' ? teamsKarte(neu) : null,
  beamerWahl.ansicht === 'ziel' ? zielKarte(neu) : null].filter(Boolean);
}

// ---------- Reiter: Klassenliste ----------

export function klasseReiter({ neu }) {
  const d = lehrerDaten();
  const feld = el('textarea', { class: 'eingabe textfeld', rows: 10, 'aria-label': 'Klassenliste',
    placeholder: 'Ein Kind pro Zeile, z. B.\nLena Schmidt; G\nJonas Becker; E' });
  feld.value = d.klasse.map((k) => `${k.anzeige}${k.kurs ? `; ${k.kurs}` : ''}`).join('\n');
  const vorschau = el('div');
  const zeigeVorschau = () => {
    const liste = klasseAusText(feld.value);
    const doppelt = liste.filter((k, i) => liste.some((x, j) => j !== i && x.kurz === k.kurz && x.kennung === k.kennung));
    vorschau.replaceChildren(...[
      liste.length ? el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Kurzname im Code'), el('th', {}, 'Kennung'), el('th', {}, 'Kurs'))),
        el('tbody', {}, liste.map((k) => el('tr', {}, el('td', {}, k.einWort ? `⚠ ${k.anzeige}` : k.anzeige), el('td', {}, el('code', {}, k.kurz)), el('td', {}, el('code', {}, k.kennung)), el('td', {}, k.kurs || '–')))))) : null,
      doppelt.length ? el('p', { class: 'meldung' }, `⚠ Doppelt: ${[...new Set(doppelt.map((k) => k.anzeige))].join(', ')}`) : null,
      liste.some((k) => k.einWort) ? el('p', { class: 'meldung' }, `⚠ Nur ein Wort: ${liste.filter((k) => k.einWort).map((k) => k.anzeige).join(', ')}. Die Kinder müssen Vor- und Nachnamen eintippen – bitte beides eintragen.`) : null
    ].filter(Boolean));
  };
  feld.addEventListener('input', zeigeVorschau);
  zeigeVorschau();
  const meldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  return [karte('Klassenliste',
    el('p', { class: 'leise' }, 'Ein Kind pro Zeile: Vorname und Nachname, optional „; G“ oder „; E“. Spalten aus Numbers/Excel und „Nachname, Vorname“ gehen auch. Die Kinder sollen ihren Namen in der App genau so eintippen. Dann ordnet die App alle Codes automatisch zu.'),
    feld,
    el('div', { class: 'zeile' }, el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
      klasseSpeichern(klasseAusText(feld.value));
      meldung.textContent = '✓ Gespeichert';
      setTimeout(neu, 800);
    } }, 'Klassenliste speichern'), meldung),
    el('h4', {}, 'So heißen die Kinder im Punktecode'),
    vorschau,
    el('p', { class: 'tipp' }, 'Hat ein Kind seinen Namen anders getippt, erscheint es im Reiter „📥 Ergebnisse“ unter „Nicht zugeordnet“. Ein Tipp genügt zum Zuordnen.')),
  zuordnungen(d).length ? karte('Zuordnungen',
    el('p', { class: 'leise' }, 'Diese anders geschriebenen Namen hast du einem Kind zugeordnet.'),
    el('ul', { class: 'zuordnen-liste' }, zuordnungen(d).map((z) => el('li', {},
      el('p', {}, el('b', {}, z.schluessel.split('|')[0]), el('span', { class: 'leise' }, ` (Kennung ${z.schluessel.split('|')[1] || '–'})`),
        ` → ${z.gueltig ? z.name : '⚠ Kind nicht mehr in der Liste'} · ${z.runden} ${z.runden === 1 ? 'Runde' : 'Runden'}`),
      el('button', { type: 'button', class: 'knopf knopf-klein', onclick: async () => {
        if (await fragen('Diese Zuordnung aufheben? Die Runden erscheinen dann wieder unter „Nicht zugeordnet“.', 'Ja, aufheben', 'Abbrechen', { hauptIstNein: true })) {
          aliasSetzen(z.schluessel, null);
          neu();
        }
      } }, 'Aufheben'))))) : null].filter(Boolean);
}

// ---------- Reiter: Sicherung ----------

export function sicherungReiter({ neu }) {
  const d = lehrerDaten();
  const ausgabe = el('div', { 'aria-live': 'polite' });
  const dateiFeld = el('input', { type: 'file', accept: '.json,application/json', class: 'datei-feld', 'aria-label': 'Sicherungsdatei wählen' });
  dateiFeld.addEventListener('change', async () => {
    const datei = dateiFeld.files?.[0];
    if (!datei) return;
    const ergebnis = sicherungEinlesen(await datei.text());
    ausgabe.replaceChildren(el('p', { class: ergebnis.ok ? 'vergleich' : 'meldung' },
      ergebnis.ok ? `✓ Sicherung geladen: ${ergebnis.neu} Runden neu dazu.` : `✗ ${ergebnis.grund}`));
    if (ergebnis.ok) setTimeout(neu, 1500);
  });
  return [karte('Sicherung',
    el('p', {}, d.letzteSicherung ? `Letzte Sicherung: ${new Date(d.letzteSicherung).toLocaleDateString('de-DE')}` : 'Noch keine Sicherung gespeichert.'),
    el('p', { class: 'leise' }, 'Die Ergebnisse liegen nur auf diesem iPad. Speichere die Sicherung z. B. in „Dateien“ (iCloud) oder schick sie dir per Mail. Mit „Sicherung laden“ kommen alle Runden zurück, auch auf ein anderes iPad.'),
    el('div', { class: 'zeile' },
      el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: async () => {
        const ok = await dateiSpeichern(`chemie-sicherung-${heute()}.json`, sicherungErstellen(), 'application/json');
        if (ok) sicherungGespeichert();
        ausgabe.replaceChildren(el('p', { class: ok ? 'vergleich' : 'meldung' }, ok ? '✓ Sicherung erstellt.' : 'Abgebrochen – es wurde keine Sicherung gespeichert.'));
        setTimeout(neu, 1500);
      } }, '💾 Sicherung speichern'),
      el('label', { class: 'knopf datei-knopf' }, '📂 Sicherung laden', dateiFeld)),
    ausgabe),
  karte('Alle Ergebnisse löschen',
    el('p', { class: 'leise' }, 'Zum Beispiel am Schuljahresende. Vorher unbedingt sichern!'),
    el('button', { type: 'button', class: 'knopf', onclick: async () => {
      if (await fragen('Alle eingelesenen Ergebnisse, die Klassenliste, die Zuordnungen, die Teams und das Klassenziel auf diesem iPad löschen?', 'Ja, alles löschen', 'Abbrechen', { hauptIstNein: true })) {
        allesLoeschen();
        neu();
      }
    } }, 'Alles löschen'))];
}

