// Ansicht für die Lehrkraft (hinter der PIN).
import { el, nameVereinheitlichen } from './hilfen.js';
import { kopfSetzen, iconKnopf, fenster, fragen, baustein } from './ui.js';
import { pinPruefen, pinPruefsumme, freischaltcode, KURSE_PRO_BEREICH } from './codes.js';
import { kinder, kindUmbenennen, kinderZusammenfuehren, kindSperren, profil, geraet, geraetAendern } from './profil.js';

let entsperrt = false;

export function adminStart(umgebung) {
  if (entsperrt) return adminSeite(umgebung);
  pinAbfrage(umgebung);
}

function pinAbfrage(umgebung) {
  const { zeigen, zurueck } = umgebung;
  kopfSetzen({ titel: 'Lehrkraft', links: iconKnopf('i-zurueck', 'Zurück', zurueck, 'knopf-rund kopf-knopf') });
  let eingabe = '';
  const punkte = el('output', { class: 'pin-anzeige', 'aria-live': 'polite' }, '');
  const meldung = el('p', { class: 'meldung', 'aria-live': 'assertive' });
  const zeichnen = () => { punkte.textContent = '●'.repeat(eingabe.length) || ' '; };
  const pruefen = () => {
    if (pinPruefen(eingabe, umgebung.daten.app.admin_pin_pruefsumme)) {
      entsperrt = true;
      adminSeite(umgebung);
    } else {
      meldung.textContent = '✗ Die PIN stimmt nicht.';
      eingabe = '';
      zeichnen();
    }
  };
  const tasten = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((z) => el('button', {
    type: 'button', class: 'knopf taste' + (z === 'OK' ? ' knopf-haupt' : ''), 'aria-label': z === '⌫' ? 'Löschen' : z,
    onclick: () => {
      meldung.textContent = '';
      if (z === 'OK') return pruefen();
      eingabe = z === '⌫' ? eingabe.slice(0, -1) : (eingabe + z).slice(0, 8);
      zeichnen();
    }
  }, z));
  zeichnen();
  zeigen(el('section', { class: 'karte pin-karte' },
    el('h2', { class: 'titel' }, 'PIN eingeben'),
    punkte, meldung,
    el('div', { class: 'tastenfeld pin-tasten' }, tasten)));
}

function abschnitt(titel, ...inhalt) {
  return el('section', { class: 'karte admin-abschnitt' }, el('h3', {}, titel), ...inhalt);
}

function adminSeite(umgebung) {
  const { daten, zeigen, zurueck } = umgebung;
  const neu = () => adminSeite(umgebung);
  kopfSetzen({
    titel: 'Lehrkraft',
    links: iconKnopf('i-zurueck', 'Zurück', zurueck, 'knopf-rund kopf-knopf'),
    rechts: [el('button', { type: 'button', class: 'knopf kopf-text-knopf', onclick: () => { entsperrt = false; zurueck(); } }, 'Abmelden')]
  });
  const g = geraet();
  const abSerie = daten.app.codes_ab_serie || 1;
  const serie = Math.max(g.serie, abSerie);

  // ----- Freischaltcodes -----
  const titelVon = (id) => daten.bereiche.find((b) => b.id === id)?.titel || id;
  const codeZeilen = Object.entries(KURSE_PRO_BEREICH).map(([bereich, kurse]) => el('tr', {},
    el('th', { scope: 'row' }, `${bereich} ${titelVon(bereich)}`),
    el('td', {}, kurse.includes('G') ? el('code', { class: 'code' }, freischaltcode(bereich, 'G', serie)) : el('span', { class: 'leise' }, 'nur E-Kurs')),
    el('td', {}, el('code', { class: 'code' }, freischaltcode(bereich, 'E', serie)))));
  const codesAlsText = () => Object.entries(KURSE_PRO_BEREICH).flatMap(([b, kurse]) =>
    kurse.map((k) => `${titelVon(b)} (${k === 'G' ? 'G-Kurs' : 'E-Kurs'}): ${freischaltcode(b, k, serie)}`)).join('\n');
  const kopierMeldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });

  const codes = abschnitt('Freischaltcodes',
    el('p', { class: 'leise' }, `Serie ${serie}. Der E-Code schaltet zusätzlich die Aufgaben nur für den E-Kurs frei (z. B. Reduktionsmittel).`),
    el('table', { class: 'tabelle' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Bereich'), el('th', {}, 'G-Kurs'), el('th', {}, 'E-Kurs'))),
      el('tbody', {}, codeZeilen)),
    el('div', { class: 'zeile' },
      el('button', { type: 'button', class: 'knopf', onclick: async () => {
        try { await navigator.clipboard.writeText(codesAlsText()); kopierMeldung.textContent = '✓ Kopiert'; } catch { kopierMeldung.textContent = 'Kopieren ging nicht.'; }
      } }, 'Alle Codes kopieren'),
      el('button', { type: 'button', class: 'knopf', onclick: async () => {
        const ja = await fragen(`Neue Codes erzeugen (Serie ${serie + 1})? Kinder, die schon freigeschaltet sind, behalten ihre Bereiche. Die alten Codes funktionieren weiter, bis du in daten/app.json "codes_ab_serie" erhöhst. Die neue Serie musst du auf jedem Lehrer-iPad gleich einstellen.`, 'Ja, neue Codes', 'Abbrechen');
        if (ja) { geraetAendern((x) => { x.serie = serie + 1; }); neu(); }
      } }, 'Neue Codes erzeugen'),
      serie > abSerie ? el('button', { type: 'button', class: 'knopf knopf-leise', onclick: () => { geraetAendern((x) => { x.serie = serie - 1; }); neu(); } }, '← Serie zurück') : null,
      kopierMeldung));

  // ----- Kinder auf diesem iPad -----
  const liste = kinder().sort((a, b) => a.name.localeCompare(b.name));
  const kinderZeilen = liste.map((k) => {
    const p = profil(k.name);
    const runden = p.runden.filter((r) => r.art === 'normal').length;
    const frei = Object.entries(p.freigeschaltet).map(([b, kurs]) => `${b} ${kurs}`).join(', ') || '–';
    return el('tr', { class: k.gesperrt ? 'gesperrt-zeile' : '' },
      el('th', { scope: 'row' }, el('span', { class: 'name-zelle' }, baustein(k.element || 'H', { klein: true }), k.name, k.gesperrt ? ' (gesperrt)' : '')),
      el('td', {}, String(runden)),
      el('td', {}, frei),
      el('td', {}, el('div', { class: 'zeile' },
        el('button', { type: 'button', class: 'knopf knopf-klein', onclick: () => umbenennen(k.name, neu) }, 'Umbenennen'),
        liste.length > 1 ? el('button', { type: 'button', class: 'knopf knopf-klein', onclick: () => zusammenfuehren(k.name, liste, neu) }, 'Zusammenführen') : null,
        el('button', { type: 'button', class: 'knopf knopf-klein', onclick: () => { kindSperren(k.name, !k.gesperrt); neu(); } }, k.gesperrt ? 'Entsperren' : 'Sperren'))));
  });
  const kinderTeil = abschnitt('Namen auf diesem iPad',
    liste.length
      ? el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Runden'), el('th', {}, 'Frei'), el('th', {}, ''))),
        el('tbody', {}, kinderZeilen)))
      : el('p', { class: 'leise' }, 'Auf diesem iPad gibt es noch keine Namen.'));

  // ----- Einstellungen -----
  const zeitlimit = el('label', { class: 'schalter' },
    el('input', { type: 'checkbox', checked: !g.zeitlimitAus, onchange: (e) => { geraetAendern((x) => { x.zeitlimitAus = !e.target.checked; }); } }),
    el('span', {}, 'Zeitbalken bei ★★★ (auf diesem iPad)'));

  const pinFeld = el('input', { type: 'text', inputmode: 'numeric', class: 'eingabe', maxlength: 8, placeholder: 'neue PIN (4–8 Ziffern)', 'aria-label': 'Neue PIN' });
  const pinAusgabe = el('div', { 'aria-live': 'polite' });
  const pinTeil = el('div', {},
    el('p', { class: 'leise' }, 'Die PIN gilt für alle iPads. So änderst du sie:'),
    el('div', { class: 'zeile' }, pinFeld, el('button', { type: 'button', class: 'knopf', onclick: () => {
      const pin = pinFeld.value.trim();
      if (!/^\d{4,8}$/.test(pin)) { pinAusgabe.replaceChildren(el('p', { class: 'meldung' }, 'Bitte 4 bis 8 Ziffern.')); return; }
      const zeile = `"admin_pin_pruefsumme": "${pinPruefsumme(pin)}",`;
      pinAusgabe.replaceChildren(
        el('p', {}, 'Öffne auf github.com die Datei ', el('b', {}, 'daten/app.json'), ', tippe auf den Stift und ersetze die Zeile mit admin_pin_pruefsumme durch:'),
        el('pre', { class: 'code-block' }, zeile),
        el('p', { class: 'leise' }, 'Nach dem Speichern gilt die neue PIN, sobald die iPads die App mit Internet geöffnet haben.'));
    } }, 'Zeile erzeugen')),
    pinAusgabe);

  const einstellungen = abschnitt('Einstellungen', zeitlimit, el('h4', {}, 'PIN ändern'), pinTeil);

  const spaeter = abschnitt('Ergebnisse und Rangliste',
    el('p', { class: 'leise' }, 'Kommt in Etappe 2: Punktecodes einlesen, Übersicht pro Kind, Rangliste für den Beamer, Sicherung.'));

  zeigen(codes, kinderTeil, einstellungen, spaeter);
}

function umbenennen(alt, fertig) {
  const feld = el('input', { type: 'text', class: 'eingabe', value: alt, 'aria-label': 'Neuer Name', autocapitalize: 'characters' });
  fenster(el('div', {}, el('p', {}, `„${alt}“ umbenennen in:`), feld,
    el('p', { class: 'leise' }, 'Gibt es den neuen Namen schon, werden beide zusammengeführt.')), {
    titel: 'Umbenennen',
    knoepfe: (zu) => [
      el('button', { type: 'button', class: 'knopf', onclick: zu }, 'Abbrechen'),
      el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => {
        const neu = nameVereinheitlichen(feld.value);
        if (neu) kindUmbenennen(alt, neu);
        zu();
        fertig();
      } }, 'Speichern')]
  });
}

function zusammenfuehren(von, liste, fertig) {
  fenster(el('div', {},
    el('p', {}, `Alle Runden und Freischaltungen von „${von}“ kommen zu:`),
    el('div', { class: 'zeile' }, liste.filter((k) => k.name !== von).map((k) =>
      el('button', { type: 'button', class: 'knopf', onclick: async (e) => {
        e.currentTarget.closest('.fenster-hintergrund').remove();
        const ja = await fragen(`„${von}“ mit „${k.name}“ zusammenführen? „${von}“ verschwindet danach.`, 'Ja, zusammenführen', 'Abbrechen');
        if (ja) kinderZusammenfuehren(von, k.name);
        fertig();
      } }, k.name)))), { titel: 'Zusammenführen' });
}
