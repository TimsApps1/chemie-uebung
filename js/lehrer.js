// Lehrer-Ansicht, Etappe 2: Ergebnisse einlesen, Übersicht, Beamer, Klassenliste, Sicherung.
import { el, sterneText, datumVonTag } from './hilfen.js';
import { fenster, fragen } from './ui.js';
import {
  lehrerDaten, einlesen, klasseAusText, klasseSpeichern, aliasSetzen, nichtZugeordnet, vorschlaege, kindName,
  rundenNachKind, uebersicht, verlauf, bestenliste, aktuelleWoche, wochenText, csvRunden, csvUebersicht,
  sicherungErstellen, sicherungGespeichert, sicherungEinlesen, sicherungFaellig, allesLoeschen, rundeLoeschen, ERINNERUNG_TAGE,
  halbjahresBeginn
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
    qrScannen((text) => {
      const bericht = einlesen(text, 'qr');
      const name = bericht.neu[0] ? bericht.neu[0].name : bericht.doppelt[0]?.split('-')[0] || '';
      const seite = (text.match(/^CHEMIE1 (\d+\/\d+)/) || [])[1];
      if (bericht.speicherVoll) return '✗ Speicher voll – nichts gespeichert!';
      return `${bericht.ungueltig.length && !bericht.neu.length ? '✗' : bericht.neu.length ? '✓' : '•'} ${name}${seite ? ` (QR ${seite})` : ''}: ${bericht.neu.length} neu` +
        (bericht.doppelt.length ? `, ${bericht.doppelt.length} schon da` : '') + (bericht.ungueltig.length ? `, ${bericht.ungueltig.length} ungültig` : '');
    }).then(() => {
      // Nach dem Schließen die Ansicht auffrischen.
      const warte = setInterval(() => { if (!document.querySelector('.scan-box')) { clearInterval(warte); neu(); } }, 500);
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
      auswahl.addEventListener('change', () => { if (auswahl.value) { aliasSetzen(schluessel, auswahl.value); neu(); } });
      return el('li', {},
        el('p', {}, el('b', {}, kurz), kennung ? el('span', { class: 'leise' }, ` (Kennung ${kennung})`) : null, ` · ${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'}, zuletzt ${datumVonTag(runden[runden.length - 1].tag)}`),
        el('div', { class: 'zeile' },
          vorschlaege(d, schluessel).slice(0, 3).map((k) => el('button', { type: 'button', class: 'knopf knopf-klein', onclick: () => { aliasSetzen(schluessel, k.id); neu(); } }, `→ ${k.anzeige}`)),
          auswahl));
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
  const v = verlauf(runden, 8);
  const max = Math.max(1, ...v.map((w) => w.punkte));
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
    el('h4', {}, 'Punkte pro Woche (letzte 8 Wochen)'),
    el('ol', { class: 'saeulen wochen-saeulen', 'aria-label': 'Punkte pro Woche: ' + v.map((w) => w.punkte).join(', ') },
      v.map((w) => el('li', { style: `--h:${Math.max(3, (w.punkte / max) * 100)}%` },
        el('span', { class: 'saeule' }), el('small', {}, String(w.punkte)), el('small', { class: 'saeule-niveau' }, datumVonTag(w.woche * 7 - 4).slice(0, 6))))),
    el('p', { class: 'tipp' }, 'Summe der Punkte aller Runden in der Woche.'),
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
      el('p', { class: 'leise' }, 'Pro Niveau: Bestwert (Ø Durchschnitt, % der Aufgaben beim 1. Versuch richtig) · Zahl der Runden. Tippe auf einen Namen für alle Runden und den Verlauf.'),
      zeitWahl,
      liste.length ? el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle uebersicht-tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Runden'), el('th', {}, 'B4 Symbole'), el('th', {}, 'B3 Redox'), el('th', {}, 'Zuletzt'))),
        el('tbody', {}, liste.map((k) => el('tr', { class: k.runden ? '' : 'leise' },
          el('th', { scope: 'row' }, el('button', { type: 'button', class: 'name-knopf', onclick: () => kindDetail(k.id, neu) }, k.name)),
          el('td', {}, `${k.runden}`, el('div', { class: 'leise klein' }, `diese Woche ${k.dieseWoche}`)),
          zelle(k, 'B4'), zelle(k, 'B3'),
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

let beamerWahl = { bereich: 'B3', niveau: 1, woche: null, kurs: '' };

function beamerAnsicht() {
  const d = lehrerDaten();
  const woche = beamerWahl.woche ?? aktuelleWoche();
  const liste = bestenliste(d, { ...beamerWahl, woche });
  sperreAussetzen(true);
  const schliessen = () => { sperreAussetzen(false); flaeche.remove(); };
  const flaeche = el('div', { class: 'beamer-flaeche', role: 'dialog', 'aria-label': 'Beamer-Ansicht' },
    el('div', { class: 'beamer' },
      el('div', { class: 'beamer-kopf' },
        el('span', { class: 'beamer-titel' }, '🏆 Die besten 5'),
        el('span', { class: 'beamer-bereich' }, `${bereichTitel(beamerWahl.bereich)} · `, el('span', { class: 'sterne' }, sterneText(beamerWahl.niveau)),
          beamerWahl.kurs ? ` · ${beamerWahl.kurs}-Kurs` : ''),
        el('button', { type: 'button', class: 'knopf beamer-zu', onclick: schliessen, 'aria-label': 'Beamer-Ansicht schließen' }, '✕')),
      el('p', { class: 'beamer-woche' }, `Woche ${wochenText(woche)} · Wochenwert = die 3 besten Runden`),
      liste.length ? el('ol', { class: 'rangliste' }, liste.map((w) => el('li', { class: 'rang' },
        el('span', { class: `rang-platz platz-${w.platz}` }, String(w.platz)),
        el('span', { class: 'rang-name' }, w.name),
        el('span', { class: 'rang-punkte' }, String(w.wert)))))
        : el('p', { class: 'beamer-leer' }, 'Diese Woche gibt es hier noch keine Runden.'),
      el('div', { class: 'beamer-umschalten' },
        [1, 2, 3].map((n) => el('button', { type: 'button', class: 'knopf' + (n === beamerWahl.niveau ? ' knopf-haupt' : ''),
          onclick: () => { beamerWahl.niveau = n; flaeche.remove(); beamerAnsicht(); } }, sterneText(n))))));
  document.body.append(flaeche);
}

export function beamerReiter({ neu }) {
  const woche = beamerWahl.woche ?? aktuelleWoche();
  const wahl = (feld, wert, text) => el('button', { type: 'button', class: 'knopf' + (beamerWahl[feld] === wert ? ' knopf-haupt' : ''),
    onclick: () => { beamerWahl[feld] = wert; neu(); } }, text);
  const vorschau = bestenliste(lehrerDaten(), { ...beamerWahl, woche });
  return [karte('Rangliste für den Beamer',
    el('p', { class: 'leise' }, 'Gezeigt werden nur die besten 5 – getrennt nach Bereich und Niveau. Wochenwert = Summe der 3 besten Runden der Woche. Niemand wird vorgeführt.'),
    el('h4', {}, 'Bereich'), el('div', { class: 'zeile' }, wahl('bereich', 'B4', 'B4 Symbole'), wahl('bereich', 'B3', 'B3 Redox')),
    el('h4', {}, 'Niveau'), el('div', { class: 'zeile' }, [1, 2, 3].map((n) => wahl('niveau', n, sterneText(n)))),
    el('h4', {}, 'Kurs'), el('div', { class: 'zeile' }, wahl('kurs', '', 'Alle'), wahl('kurs', 'G', 'G-Kurs'), wahl('kurs', 'E', 'E-Kurs')),
    el('h4', {}, 'Woche'),
    el('div', { class: 'zeile' },
      el('button', { type: 'button', class: 'knopf', 'aria-label': 'Woche davor', onclick: () => { beamerWahl.woche = woche - 1; neu(); } }, '◀'),
      el('span', { class: 'woche-text' }, wochenText(woche), woche === aktuelleWoche() ? ' (diese Woche)' : ''),
      el('button', { type: 'button', class: 'knopf', 'aria-label': 'Woche danach', disabled: woche >= aktuelleWoche(), onclick: () => { beamerWahl.woche = woche + 1; neu(); } }, '▶')),
    el('h4', {}, 'Vorschau'),
    vorschau.length ? el('ul', { class: 'vorschau-liste' }, vorschau.map((w) => el('li', {}, `${w.platz}. ${w.name} – ${w.wert} (${w.runden} ${w.runden === 1 ? 'Runde' : 'Runden'})`)))
      : el('p', { class: 'leise' }, 'Für diese Auswahl gibt es noch keine Runden.'),
    el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross', onclick: beamerAnsicht }, '🖥 Beamer-Ansicht öffnen'))];
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
    vorschau.replaceChildren(
      liste.length ? el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Kurzname im Code'), el('th', {}, 'Kennung'), el('th', {}, 'Kurs'))),
        el('tbody', {}, liste.map((k) => el('tr', {}, el('td', {}, k.anzeige), el('td', {}, el('code', {}, k.kurz)), el('td', {}, el('code', {}, k.kennung)), el('td', {}, k.kurs || '–')))))) : null,
      doppelt.length ? el('p', { class: 'meldung' }, `⚠ Doppelt: ${[...new Set(doppelt.map((k) => k.anzeige))].join(', ')}`) : null);
  };
  feld.addEventListener('input', zeigeVorschau);
  zeigeVorschau();
  const meldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  return [karte('Klassenliste',
    el('p', { class: 'leise' }, 'Ein Kind pro Zeile: Vorname und Nachname, optional „; G“ oder „; E“. Die Kinder sollen ihren Namen in der App genau so eintippen. Dann ordnet die App alle Codes automatisch zu.'),
    feld,
    el('div', { class: 'zeile' }, el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
      klasseSpeichern(klasseAusText(feld.value));
      meldung.textContent = '✓ Gespeichert';
      setTimeout(neu, 800);
    } }, 'Klassenliste speichern'), meldung),
    el('h4', {}, 'So heißen die Kinder im Punktecode'),
    vorschau,
    el('p', { class: 'tipp' }, 'Hat ein Kind seinen Namen anders getippt, erscheint es im Reiter „📥 Ergebnisse“ unter „Nicht zugeordnet“. Ein Tipp genügt zum Zuordnen.'))];
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
      if (await fragen('Alle eingelesenen Ergebnisse, die Klassenliste und die Zuordnungen auf diesem iPad löschen?', 'Ja, alles löschen', 'Abbrechen', { hauptIstNein: true })) {
        allesLoeschen();
        neu();
      }
    } }, 'Alles löschen'))];
}

