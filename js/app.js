// Start der App und alle Bildschirme für Schülerinnen und Schüler.
import { VERSION } from './version.js';
import { dauerhaftBitten } from './speicher.js';
import { el, formelKnoten, sterneText, nameVereinheitlichen, tagNummer, wocheVonTag, datumVonTag, mischen } from './hilfen.js';
import { allesLaden, alleFehler } from './daten.js';
import {
  symboleEinfuegen, kopfSetzen, icon, iconKnopf, baustein, fenster, text, vorlesenKnopf,
  fachwoerterSetzen, datenFehlerKasten
} from './ui.js';
import {
  anzeigeName, ersteWoche, naechsteRundenNummer,
  kinder, kindEintrag, kindAnlegen, profil, aendern, freischalten, rundeSpeichern, rundenInWoche,
  normaleRunden, bestwert, sterneFuer, niveauVorschlag, faelligeFehler, KANN_SCHWELLE, LIEBLINGSELEMENTE, geraet
} from './profil.js';
import { freischaltcodePruefen, codeTippfehlerHinweis, punktecode } from './codes.js';
import { rundeSpielen, aufgabenWaehlen, RUNDE_LAENGE } from './runde.js';
import { adminStart } from './admin.js';

const inhalt = document.getElementById('inhalt');
let daten = null;

document.getElementById('version').textContent = `Version ${VERSION}`;

// ---------- Offline-Speicher und "Neue Version" ----------

let nutzerWillUpdate = false;

function updateAnbieten(worker) {
  const hinweis = document.getElementById('update-hinweis');
  const k = document.getElementById('update-knopf');
  hinweis.hidden = false;
  k.onclick = () => {
    nutzerWillUpdate = true;
    k.disabled = true;
    k.textContent = 'Lädt …';
    worker.postMessage('jetzt-aktualisieren');
  };
}

async function offlineEinrichten() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (nutzerWillUpdate) window.location.reload();
    });
    if (reg.waiting && navigator.serviceWorker.controller) updateAnbieten(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      if (!neu) return;
      neu.addEventListener('statechange', () => {
        if (neu.state === 'installed' && navigator.serviceWorker.controller) updateAnbieten(neu);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch { /* ohne Offline-Speicher geht es trotzdem */ }
}

const alsAppGestartet = () => window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

// ---------- Hilfen für Bildschirme ----------

function zeigen(...knoten) {
  inhalt.replaceChildren(...knoten.filter(Boolean));
  window.scrollTo(0, 0);
}

const bereichInfo = (id) => daten.bereiche.find((b) => b.id === id);

function bereicheFrei(p) {
  return daten.bereiche.filter((b) => p.freigeschaltet[b.id]);
}

function lehrkraftLink() {
  return el('button', { type: 'button', class: 'lehrkraft-link', onclick: () => adminStart({ daten, zeigen, zurueck: werUebt }) },
    icon('i-schluessel'), 'Lehrkraft');
}

function installTipp() {
  if (alsAppGestartet()) return null;
  return el('p', { class: 'install-tipp' },
    '📲 Tipp: Tippe oben auf Teilen ⬆ und dann auf „Zum Home-Bildschirm“. Dann bleiben deine Punkte sicher gespeichert.');
}

// ---------- Wer übt? ----------

function werUebt() {
  kopfSetzen();
  const liste = kinder().filter((k) => !k.gesperrt).sort((a, b) => a.name.localeCompare(b.name));
  const namen = el('div', { class: 'namen' },
    liste.map((k) => el('button', { type: 'button', class: 'knopf knopf-name', onclick: () => startseite(k.name) },
      baustein(k.element || 'H', { klein: true }), el('span', {}, k.name),
      k.anzeige && k.anzeige.toUpperCase() !== k.name ? el('small', { class: 'name-voll' }, k.anzeige) : null)),
    el('button', { type: 'button', class: 'knopf knopf-name knopf-neu', onclick: neuerName }, icon('i-plus'), 'Neuer Name'));
  zeigen(
    datenFehlerKasten(alleFehler()),
    el('section', { class: 'karte' },
      el('div', { class: 'anweisung-zeile' }, el('h2', { class: 'titel' }, 'Wer übt?'), vorlesenKnopf('Wer übt? Tippe auf deinen Namen.')),
      el('p', { class: 'leise' }, '✋ Tippe auf deinen Namen.'),
      namen),
    installTipp(),
    lehrkraftLink());
}

function neuerName() {
  kopfSetzen({ links: iconKnopf('i-zurueck', 'Zurück', werUebt, 'knopf-rund kopf-knopf') });
  let element = mischen(LIEBLINGSELEMENTE)[0];
  const feld = el('input', {
    type: 'text', class: 'eingabe', id: 'name-feld', autocomplete: 'off', autocapitalize: 'characters',
    spellcheck: false, maxlength: 40, placeholder: 'z. B. Lena Schulz', 'aria-describedby': 'name-vorschau'
  });
  const vorschau = el('p', { class: 'name-vorschau', id: 'name-vorschau' });
  const meldung = el('p', { class: 'meldung', 'aria-live': 'polite' });
  const los = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', disabled: true, onclick: anlegen }, 'Los geht’s ➜');

  const steine = el('div', { class: 'element-wahl', role: 'radiogroup', 'aria-label': 'Lieblingselement' },
    LIEBLINGSELEMENTE.map((s) => {
      const info = daten.elemente.find((e) => e.symbol === s);
      const b = el('button', { type: 'button', class: 'element-knopf' + (s === element ? ' gewaehlt' : ''), role: 'radio',
        'aria-checked': String(s === element), 'aria-label': info?.name || s,
        onclick: () => {
          element = s;
          steine.querySelectorAll('.element-knopf').forEach((x) => {
            const an = x === b;
            x.classList.toggle('gewaehlt', an);
            x.setAttribute('aria-checked', String(an));
          });
        } }, baustein(s, { metall: info?.metall, klein: true }), el('small', {}, info?.name || s));
      return b;
    }));

  // Kurzname aus Vorname und Nachname: höchstens 8 Zeichen, A–Z und 0–9.
  function kurzname() { return nameVereinheitlichen(feld.value); }
  function freieVariante(n) {
    for (let z = 2; z <= 9; z++) {
      const v = n.slice(0, 7) + z;
      if (!kindEintrag(v)) return v;
    }
    return null;
  }
  function pruefen() {
    const n = kurzname();
    meldung.textContent = '';
    if (feld.value.trim() && !n) {
      vorschau.replaceChildren('Bitte mit den Buchstaben A bis Z schreiben.');
      los.disabled = true;
      return;
    }
    vorschau.replaceChildren(...(n ? ['So heißt du in der App und im Punktecode: ', el('b', {}, n)] : ['Schreib deinen Vornamen und Nachnamen.']));
    const eintrag = n && kindEintrag(n);
    if (eintrag?.gesperrt) meldung.textContent = 'Diesen Namen kannst du nicht nehmen. Frag deine Lehrkraft.';
    else if (eintrag) {
      const anders = eintrag.anzeige && eintrag.anzeige.toLowerCase() !== feld.value.trim().toLowerCase();
      meldung.textContent = anders
        ? `${n} gibt es schon (${eintrag.anzeige}). Bist du das nicht? Dann heißt du ${freieVariante(n) || n}.`
        : 'Diesen Namen gibt es schon auf diesem iPad. Bist du das? Dann tippe auf „Los geht’s“.';
    }
    los.disabled = !n || Boolean(eintrag?.gesperrt);
  }
  function anlegen() {
    let n = kurzname();
    if (!n || kindEintrag(n)?.gesperrt) return;
    const eintrag = kindEintrag(n);
    if (eintrag && eintrag.anzeige && eintrag.anzeige.toLowerCase() !== feld.value.trim().toLowerCase()) {
      n = freieVariante(n) || n;
    }
    kindAnlegen(n, element, feld.value.trim());
    startseite(n);
  }
  feld.addEventListener('input', pruefen);
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !los.disabled) anlegen(); });
  pruefen();
  zeigen(el('section', { class: 'karte' },
    el('h2', { class: 'titel' }, 'Neuer Name'),
    el('label', { for: 'name-feld', class: 'beschriftung' }, '✏️ Dein Vorname und Nachname'),
    feld, vorschau, meldung,
    el('p', { class: 'beschriftung' }, '✋ Wähle dein Lieblingselement. Daran erkennst du deinen Namen.'),
    steine,
    los));
  feld.focus();
}

// ---------- Startseite ----------

function kopfMitName(name, extra = {}) {
  kopfSetzen({
    rechts: [el('button', { type: 'button', class: 'kopf-name', onclick: werUebt, 'aria-label': `${name}. Tippen zum Wechseln.` },
      baustein(kindEintrag(name)?.element || 'H', { klein: true }), name)],
    ...extra
  });
}

function heuteUebenPlan(name, p) {
  const frei = bereicheFrei(p).filter((b) => !b.kommt_bald);
  if (!frei.length) return null;
  const fehlerFaellig = faelligeFehler(p, frei.map((b) => b.id));
  if (fehlerFaellig.length) return { art: 'fehler', text: `Erst ${fehlerFaellig.length === 1 ? 'deinen Fehler' : `deine ${Math.min(fehlerFaellig.length, RUNDE_LAENGE)} Fehler`} von früher ausbessern` };
  const letzte = p.letzte && frei.some((b) => b.id === p.letzte.bereich) ? p.letzte : { bereich: frei[0].id, niveau: 1 };
  return { art: 'normal', bereich: letzte.bereich, niveau: letzte.niveau,
    text: `${bereichInfo(letzte.bereich).titel} · ${sterneText(letzte.niveau)}` };
}

function startseite(name) {
  if (!kindEintrag(name) || kindEintrag(name).gesperrt) return werUebt();
  const p = profil(name);
  kopfMitName(name);
  const plan = heuteUebenPlan(name, p);
  const woche = wocheVonTag(tagNummer());
  const geschafft = rundenInWoche(p, woche);

  const kacheln = daten.bereiche.map((b) => bereichKachel(name, p, b));
  const nochGesperrt = daten.bereiche.some((b) => !p.freigeschaltet[b.id]);

  zeigen(
    datenFehlerKasten(alleFehler()),
    el('section', { class: 'start-kopf' },
      el('h2', { class: 'titel' }, `Hallo ${name}!`),
      plan ? el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross heute-knopf', onclick: () => planStarten(name, plan) },
        el('span', { class: 'heute-titel' }, '▶ Heute üben'), el('span', { class: 'heute-text' }, plan.text)) : null),
    !bereicheFrei(p).length
      ? el('section', { class: 'karte hinweis-karte' },
        el('p', {}, '🔑 Du hast noch keinen Bereich. Gib den Code von deiner Lehrkraft ein.'),
        el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => codeEingeben(name) }, 'Code eingeben'))
      : null,
    el('section', { class: 'wochenziel karte' },
      el('div', { class: 'wochenziel-kopf' },
        el('h3', {}, 'Mein Wochenziel'),
        el('span', { class: 'wochenziel-zahl' }, `${Math.min(geschafft, p.wochenziel)} von ${p.wochenziel} Runden`)),
      stempelReihe(p.wochenziel, geschafft),
      geschafft >= p.wochenziel ? el('p', { class: 'wochenziel-geschafft' }, '✓ Wochenziel geschafft! Jede weitere Runde ist ein Bonus.') : null),
    el('div', { class: 'bereiche' }, kacheln),
    el('div', { class: 'start-knoepfe' },
      el('button', { type: 'button', class: 'knopf', onclick: () => meinFortschritt(name) }, '📈 Mein Fortschritt'),
      nochGesperrt ? el('button', { type: 'button', class: 'knopf', onclick: () => codeEingeben(name) }, icon('i-schluessel'), 'Code eingeben') : null),
    installTipp());
}

function stempelReihe(ziel, geschafft, klein = false) {
  return el('ol', { class: 'stempel' + (klein ? ' stempel-klein' : ''), 'aria-label': `${Math.min(geschafft, ziel)} von ${ziel} Runden geschafft` },
    Array.from({ length: ziel }, (_, i) => el('li', { class: i < geschafft ? 'voll' : '' }, i < geschafft ? '✓' : '')));
}

function bereichKachel(name, p, b) {
  const kurs = p.freigeschaltet[b.id];
  const zeichen = icon(`b-${b.bildzeichen}`, 'kachel-zeichen');
  const kachel = el('span', { class: 'kachel' }, el('span', { class: 'kachel-nr' }, b.id), zeichen);
  if (!kurs) {
    return el('div', { class: `bereich ${b.id.toLowerCase()} gesperrt` }, kachel,
      el('div', {}, el('p', { class: 'bereich-name' }, b.titel),
        el('p', { class: 'leise klein' }, icon('i-schloss', 'mini-icon'), ' Noch zu. Du brauchst einen Code.')));
  }
  if (b.kommt_bald) {
    return el('div', { class: `bereich ${b.id.toLowerCase()} gesperrt` }, kachel,
      el('div', {}, el('p', { class: 'bereich-name' }, b.titel), el('p', { class: 'leise klein' }, '🛠 Kommt bald.')));
  }
  const stufen = el('div', { class: 'stufen' }, [1, 2, 3].map((n) => {
    const best = bestwert(p, b.id, n);
    return el('div', { class: 'stufe' },
      el('span', { class: 'sterne' + (normaleRunden(p, b.id, n).length ? '' : ' offen') }, sterneText(n)),
      el('span', { class: 'fortschritt-balken' }, el('span', { style: `--wert:${Math.min(100, (best / 80) * 100)}%` })),
      el('span', { class: 'stufe-wert' }, medaillen(sterneFuer(best))));
  }));
  return el('button', { type: 'button', class: `bereich ${b.id.toLowerCase()}`, onclick: () => bereichSeite(name, b.id) },
    kachel,
    el('div', {}, el('p', { class: 'bereich-name' }, b.titel), stufen));
}

const medaillen = (n) => el('span', { class: `medaillen medaille-${n}`, role: 'img', 'aria-label': n ? `${['', 'Bronze', 'Silber', 'Gold'][n]}-Medaille` : 'noch keine Medaille' },
  [1, 2, 3].map((i) => el('span', { class: i <= n ? 'medaille-voll' : 'medaille-leer' })));

// ---------- Code eingeben ----------

function codeEingeben(name) {
  kopfMitName(name, { links: iconKnopf('i-zurueck', 'Zurück', () => startseite(name), 'knopf-rund kopf-knopf') });
  const feld = el('input', { type: 'text', class: 'eingabe eingabe-code', id: 'code-feld', autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: false, maxlength: 12, placeholder: 'z. B. K7MQ2X' });
  const meldung = el('div', { 'aria-live': 'polite' });
  const ok = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: pruefen }, 'Freischalten');
  function pruefen() {
    const treffer = freischaltcodePruefen(feld.value, daten.app.codes_ab_serie || 1);
    if (!treffer) {
      meldung.replaceChildren(el('div', { class: 'rueckmeldung falsch' },
        el('span', { class: 'marke', 'aria-hidden': 'true' }, '✗'),
        el('p', { class: 'rueckmeldung-titel' }, 'Das hat nicht geklappt.'),
        el('p', { class: 'breit' }, codeTippfehlerHinweis(feld.value))));
      return;
    }
    freischalten(name, treffer.bereich, treffer.kurs);
    const b = bereichInfo(treffer.bereich);
    meldung.replaceChildren(el('div', { class: 'rueckmeldung richtig' },
      el('span', { class: 'marke', 'aria-hidden': 'true' }, '✓'),
      el('p', { class: 'rueckmeldung-titel' }, `${b?.titel || treffer.bereich} ist frei!`),
      el('p', { class: 'breit' }, treffer.kurs === 'E' ? 'Mit allen Aufgaben für den E-Kurs.' : 'Viel Spaß beim Üben.')),
    el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: () => startseite(name) }, 'Weiter ➜'));
    ok.hidden = true;
  }
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefen(); });
  zeigen(el('section', { class: 'karte' },
    el('h2', { class: 'titel' }, 'Code eingeben'),
    el('label', { for: 'code-feld', class: 'beschriftung' }, '🔑 Den Code bekommst du von deiner Lehrkraft.'),
    feld, ok, meldung));
  feld.focus();
}

// ---------- Bereich: Geschichte und Niveau wählen ----------

function geschichteZeigen(b, weiter) {
  const g = b.geschichte;
  fenster(el('div', { class: 'geschichte' },
    g.bild ? el('img', { src: `bilder/${g.bild}`, alt: '', class: 'geschichte-bild' }) : el('div', { class: `geschichte-platz ${b.id.toLowerCase()}` }, icon(`b-${b.bildzeichen}`)),
    el('p', { class: 'fenster-text' }, text(g.text)),
    el('div', { class: 'zeile-rechts' }, vorlesenKnopf(`${g.titel}. ${g.text}`))),
  { titel: g.titel, knoepfe: (zu) => [el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => { zu(); weiter?.(); } }, 'Los geht’s ➜')] });
}

function bereichSeite(name, bereichId) {
  const b = bereichInfo(bereichId);
  const p = profil(name);
  const kurs = p.freigeschaltet[bereichId];
  kopfMitName(name, { links: iconKnopf('i-zurueck', 'Zurück', () => startseite(name), 'knopf-rund kopf-knopf'), titel: b.titel, farbe: bereichId.toLowerCase() });

  if (b.geschichte && !p.geschichteGesehen[bereichId]) {
    aendern(name, (x) => { x.geschichteGesehen[bereichId] = true; });
    geschichteZeigen(b);
  }
  const vorschlag = [1, 2].map((n) => niveauVorschlag(p, bereichId, n)).filter(Boolean).pop();

  const niveaus = [1, 2, 3].map((n) => {
    const anzahl = (daten.aufgaben[bereichId] || []).filter((a) => a.niveau === n && (a.kurs !== 'E' || kurs === 'E')).length;
    const runden = normaleRunden(p, bereichId, n);
    const best = bestwert(p, bereichId, n);
    return el('button', {
      type: 'button', class: 'knopf niveau-knopf' + (vorschlag === n ? ' vorgeschlagen' : ''), disabled: anzahl < 2,
      onclick: () => rundeStarten(name, bereichId, n)
    },
    el('span', { class: 'sterne' }, sterneText(n)),
    el('span', { class: 'niveau-text' }, formelKnoten(b.niveaus?.[n] || '')),
    el('span', { class: 'niveau-stand' }, runden.length ? `Bestwert ${best} · ${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'}` : 'Noch nicht geübt'),
    vorschlag === n ? el('span', { class: 'vorschlag-marke' }, `Traust du dir ${sterneText(n)} zu?`) : null);
  });

  zeigen(el('section', { class: 'karte' },
    el('div', { class: 'anweisung-zeile' }, el('h2', { class: 'titel' }, 'Wähle dein Niveau'), vorlesenKnopf('Wähle dein Niveau. Ein Stern, zwei Sterne oder drei Sterne.')),
    el('p', { class: 'leise' }, '✋ Du entscheidest. Du kannst jederzeit wechseln.'),
    el('div', { class: 'niveaus' }, niveaus),
    b.geschichte ? el('button', { type: 'button', class: 'knopf knopf-leise', onclick: () => geschichteZeigen(b) }, '📖 Geschichte nochmal lesen') : null));
}

// ---------- Runde starten und beenden ----------

function rundeStarten(name, bereichId, niveau) {
  const p = profil(name);
  const kurs = p.freigeschaltet[bereichId];
  const aufgaben = aufgabenWaehlen(daten.aufgaben[bereichId] || [], niveau, kurs);
  if (!aufgaben.length) return startseite(name);
  const kannVorher = { ...p.kann };
  rundeSpielen({
    ziel: inhalt, daten, name, bereich: bereichId, niveau, kurs, aufgaben, art: 'normal',
    fertig: (ergebnis) => (ergebnis ? rundenende(name, ergebnis, kannVorher) : startseite(name))
  });
}

function planStarten(name, plan) {
  if (plan.art === 'normal') return rundeStarten(name, plan.bereich, plan.niveau);
  const p = profil(name);
  const frei = bereicheFrei(p).map((b) => b.id);
  const faellig = faelligeFehler(p, frei).slice(0, RUNDE_LAENGE);
  const alle = Object.values(daten.aufgaben).flat();
  const aufgaben = faellig.map((f) => alle.find((a) => a.id === f.id)).filter(Boolean);
  if (!aufgaben.length) {
    // Aufgaben gibt es nicht mehr (Datei geändert): Fehler löschen.
    aendern(name, (x) => { faellig.forEach((f) => delete x.fehler[f.id]); });
    return startseite(name);
  }
  const kannVorher = { ...p.kann };
  rundeSpielen({
    ziel: inhalt, daten, name, bereich: faellig[0].bereich, niveau: 1, kurs: 'E', aufgaben, art: 'fehler',
    fertig: (ergebnis) => (ergebnis ? fehlerRundeEnde(name, ergebnis, kannVorher) : startseite(name))
  });
}

// Neu erreichte Ich-kann-Sätze seit Rundenbeginn.
function neueIchKann(name, kannVorher) {
  const p = profil(name);
  return daten.bereiche.flatMap((b) => (b.ich_kann || [])
    .filter((k) => !k.kurs || p.freigeschaltet[b.id] === 'E')
    .filter((k) => (kannVorher[k.id] || 0) < KANN_SCHWELLE && (p.kann[k.id] || 0) >= KANN_SCHWELLE));
}

function neuZeile(zeichen, inhaltKnoten, klasse = '') {
  return el('li', { class: `neu-zeile ${klasse}`.trim() }, el('span', { class: 'neu-zeichen', 'aria-hidden': 'true' }, zeichen), el('span', {}, inhaltKnoten));
}

function wochenzielZeile(p, vorher) {
  const jetzt = rundenInWoche(p);
  if (jetzt >= p.wochenziel && vorher < p.wochenziel) return neuZeile('🗓', el('b', {}, 'Wochenziel geschafft!'), 'stark');
  if (jetzt < p.wochenziel) return neuZeile('🗓', [`Wochenziel: ${jetzt} von ${p.wochenziel} Runden `, stempelReihe(p.wochenziel, jetzt, true)]);
  return neuZeile('🗓', `Bonusrunde! Diese Woche schon ${jetzt} Runden.`);
}

function fehlerRundeEnde(name, ergebnis, kannVorher) {
  const vorher = rundenInWoche(profil(name));
  const p = rundeSpeichern(name, { art: 'fehler', bereich: ergebnis.bereich, niveau: 0, punkte: 0, ersterVersuch: ergebnis.ersterVersuch, anzahl: ergebnis.anzahl, falsch: ergebnis.falsch });
  const neuKann = neueIchKann(name, kannVorher);
  kopfMitName(name);
  zeigen(el('section', { class: 'karte ergebnis' },
    el('h2', { class: 'titel' }, 'Fehler-Runde geschafft!'),
    el('p', { class: 'ergebnis-satz' }, `${ergebnis.anzahl} ${ergebnis.anzahl === 1 ? 'Fehler' : 'Fehler'} geübt` +
      (ergebnis.ausgebessert ? ` · ${ergebnis.ausgebessert} endgültig erledigt` : '')),
    el('ul', { class: 'neu-liste' },
      ergebnis.ausgebessert ? neuZeile('🏆', el('b', {}, `${ergebnis.ausgebessert} ${ergebnis.ausgebessert === 1 ? 'Fehler sitzt' : 'Fehler sitzen'} jetzt sicher!`), 'stark') : null,
      ergebnis.ersterVersuch ? neuZeile('✓', `${ergebnis.ersterVersuch} gleich beim ersten Versuch richtig.`) : neuZeile('💪', 'Dranbleiben lohnt sich – diese Aufgaben kommen bald wieder.'),
      ...neuKann.map((k) => neuZeile('⭐', ['Neu: ', el('b', {}, text(k.text))], 'stark')),
      wochenzielZeile(p, vorher)),
    el('p', { class: 'leise' }, 'Aufgaben, die noch nicht sitzen, kommen in ein paar Tagen wieder.'),
    el('button', { type: 'button', class: 'knopf knopf-haupt knopf-gross knopf-breit', onclick: () => startseite(name) }, icon('i-haus'), 'Startseite')));
}

const MEDAILLE = ['', 'Bronze', 'Silber', 'Gold'];

function rundenende(name, ergebnis, kannVorher) {
  const vorher = profil(name);
  const fruehere = normaleRunden(vorher, ergebnis.bereich, ergebnis.niveau);
  const alterBest = fruehere.reduce((m, r) => Math.max(m, r.punkte), 0);
  const letzte = fruehere[fruehere.length - 1];
  const wocheVorher = rundenInWoche(vorher);
  const tag = tagNummer();
  const nummer = naechsteRundenNummer(vorher);
  const code = punktecode({ name, bereich: ergebnis.bereich, niveau: ergebnis.niveau, punkte: ergebnis.punkte, tag, kurs: ergebnis.kurs, nummer });
  const p = rundeSpeichern(name, { art: 'normal', bereich: ergebnis.bereich, niveau: ergebnis.niveau, kurs: ergebnis.kurs,
    punkte: ergebnis.punkte, ersterVersuch: ergebnis.ersterVersuch, anzahl: ergebnis.anzahl,
    warumRichtig: ergebnis.warumRichtig, falsch: ergebnis.falsch, nummer, code }, tag);
  const rekord = fruehere.length > 0 && ergebnis.punkte > alterBest;
  const medailleAlt = sterneFuer(alterBest);
  const medailleNeu = sterneFuer(Math.max(alterBest, ergebnis.punkte));
  const vorschlag = niveauVorschlag(p, ergebnis.bereich, ergebnis.niveau);
  const b = bereichInfo(ergebnis.bereich);
  const zweiterVersuch = Math.max(0, (ergebnis.punkte - ergebnis.warumRichtig * 5 - ergebnis.ersterVersuch * 10) / 5);

  // Alles Neue und Gute dieser Runde (nur Verbesserungen, nie Verschlechterungen).
  const neu = [];
  if (rekord) neu.push(neuZeile('🏆', el('b', {}, `Neuer persönlicher Rekord! Vorher: ${alterBest}`), 'stark'));
  if (medailleNeu > medailleAlt) neu.push(neuZeile(medaillen(medailleNeu), el('b', {}, `${MEDAILLE[medailleNeu]}-Medaille auf ${sterneText(ergebnis.niveau)} erreicht!`), 'stark'));
  for (const k of neueIchKann(name, kannVorher)) neu.push(neuZeile('⭐', ['Neu: ', el('b', {}, text(k.text))], 'stark'));
  if (!letzte) neu.push(neuZeile('🚀', 'Deine erste Runde auf diesem Niveau. Gut, dass du angefangen hast!'));
  else if (ergebnis.ersterVersuch > letzte.ersterVersuch) neu.push(neuZeile('↑', `Letztes Mal ${letzte.ersterVersuch}, heute ${ergebnis.ersterVersuch} Aufgaben gleich beim ersten Versuch richtig.`));
  if (ergebnis.ausgebessert) neu.push(neuZeile('✓', `${ergebnis.ausgebessert} ${ergebnis.ausgebessert === 1 ? 'Fehler' : 'Fehler'} am Ende ausgebessert.`));
  if (neu.length === 0 || (!rekord && medailleNeu <= medailleAlt && !(letzte && ergebnis.ersterVersuch > letzte.ersterVersuch))) {
    neu.push(neuZeile('💪', zweiterVersuch > 0
      ? `${zweiterVersuch} ${zweiterVersuch === 1 ? 'Aufgabe' : 'Aufgaben'} mit Denkanstoß geschafft – genau so lernt man.`
      : 'Du bleibst dran – jede Runde macht dich sicherer.'));
  }
  neu.push(wochenzielZeile(p, wocheVorher));

  const codeText = el('span', { class: 'code', id: 'punktecode' }, code);
  const kopierMeldung = el('span', { class: 'kopier-meldung', 'aria-live': 'polite' });
  const kopieren = el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: async () => {
    const geklappt = await inZwischenablage(code, codeText);
    kopierMeldung.textContent = geklappt ? '✓ Kopiert! Füge ihn in Classroom ein.' : 'Bitte den Code lange drücken und „Kopieren“ wählen.';
  } }, icon('i-kopie'), 'Kopieren');

  kopfMitName(name, { titel: b.titel, farbe: ergebnis.bereich.toLowerCase() });
  zeigen(
    el('section', { class: 'karte ergebnis' },
      el('h2', { class: 'titel' }, 'Runde geschafft!'),
      el('p', { class: 'ergebnis-punkte' }, String(ergebnis.punkte)),
      el('p', { class: 'ergebnis-einheit' }, 'Punkte'),
      ergebnis.warumRichtig ? el('p', { class: 'leise' }, `davon ${ergebnis.warumRichtig * 5} Extrapunkte für gute Begründungen`) : null,
      el('ul', { class: 'neu-liste' }, neu),
      vorschlag ? el('div', { class: 'vorschlag' },
        el('p', {}, el('b', {}, `Traust du dir ${sterneText(vorschlag)} zu?`), ' Du warst zweimal richtig gut.'),
        el('div', { class: 'zeile' },
          el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => rundeStarten(name, ergebnis.bereich, vorschlag) }, `Ja, ${sterneText(vorschlag)} probieren`),
          el('button', { type: 'button', class: 'knopf', onclick: (e) => {
            aendern(name, (x) => { x.niveauVorschlagAbgelehnt[`${ergebnis.bereich}-${ergebnis.niveau}`] = x.runden.length; });
            e.currentTarget.closest('.vorschlag').remove();
          } }, 'Lieber hier bleiben'))) : null,
      el('div', { class: 'zeile' },
        el('button', { type: 'button', class: 'knopf knopf-gross', style: 'flex:1', onclick: () => rundeStarten(name, ergebnis.bereich, ergebnis.niveau) }, '↻ Nochmal'),
        el('button', { type: 'button', class: 'knopf knopf-gross', style: 'flex:1', onclick: () => startseite(name) }, icon('i-haus'), 'Startseite'))),
    el('section', { class: 'karte code-karte' },
      el('h3', {}, 'Für deine Lehrkraft'),
      el('p', { class: 'leise' }, 'Kopiere den Punktecode und schick ihn deiner Lehrkraft. Du findest ihn später auch unter „Mein Fortschritt“.'),
      el('div', { class: 'code-feld' }, codeText, kopieren),
      kopierMeldung));
}

async function inZwischenablage(textInhalt, knoten) {
  try {
    await navigator.clipboard.writeText(textInhalt);
    return true;
  } catch {
    try {
      const r = document.createRange();
      r.selectNodeContents(knoten);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

// Code einer gespeicherten Runde (ältere Runden ohne gespeicherten Code bekommen ihn nachträglich).
function codeVonRunde(name, p, r, i) {
  return r.code || punktecode({ name, bereich: r.bereich, niveau: r.niveau, punkte: r.punkte, tag: r.tag,
    kurs: r.kurs || p.freigeschaltet[r.bereich] || 'G', nummer: r.nummer ?? i + 1 });
}

// ---------- Mein Fortschritt ----------

function meinFortschritt(name) {
  const p = profil(name);
  kopfMitName(name, { links: iconKnopf('i-zurueck', 'Zurück', () => startseite(name), 'knopf-rund kopf-knopf'), titel: 'Mein Fortschritt' });
  const frei = bereicheFrei(p).filter((b) => !b.kommt_bald);
  const heute = wocheVonTag(tagNummer());

  const zielWahl = el('div', { class: 'zeile', role: 'radiogroup', 'aria-label': 'Wochenziel' }, [1, 2, 3].map((n) =>
    el('button', { type: 'button', class: 'knopf' + (p.wochenziel === n ? ' knopf-haupt' : ''), role: 'radio', 'aria-checked': String(p.wochenziel === n),
      onclick: () => { aendern(name, (x) => { x.wochenziel = n; }); meinFortschritt(name); } }, `${n} ${n === 1 ? 'Runde' : 'Runden'}`)));

  // Stempelkarte wächst: von der ersten Übungswoche bis heute (höchstens 8 Wochen sichtbar).
  const start = Math.max(ersteWoche(p), heute - 7);
  const wochen = el('ol', { class: 'stempelkarte', 'aria-label': 'Meine Stempel' },
    Array.from({ length: heute - start + 1 }, (_, i) => {
      const w = start + i;
      const voll = p.stempel.includes(w);
      return el('li', { class: voll ? 'voll' : '' }, el('span', { class: 'stempel-zeichen' }, voll ? '✓' : ''),
        el('small', {}, w === heute ? 'diese Woche' : `ab ${datumVonTag(w * 7 - 4).slice(0, 6)}`));
    }));

  const bereichsBlock = (b) => {
    const zeilen = [1, 2, 3].map((n) => {
      const r = normaleRunden(p, b.id, n);
      const best = bestwert(p, b.id, n);
      return el('tr', {},
        el('th', { scope: 'row' }, el('span', { class: 'sterne' + (r.length ? '' : ' offen') }, sterneText(n))),
        el('td', {}, medaillen(sterneFuer(best))),
        el('td', {}, r.length ? String(best) : '–'),
        el('td', {}, String(r.length)));
    });
    const kannListe = (b.ich_kann || []).filter((k) => !k.kurs || p.freigeschaltet[b.id] === 'E').map((k) => {
      const n = p.kann[k.id] || 0;
      const fertigJa = n >= KANN_SCHWELLE;
      return el('li', { class: fertigJa ? 'kann-ja' : '' },
        el('span', { class: 'marke-klein', 'aria-label': fertigJa ? 'geschafft' : `${Math.min(n, KANN_SCHWELLE)} von ${KANN_SCHWELLE}` },
          fertigJa ? '✓' : `${Math.min(n, KANN_SCHWELLE)}/${KANN_SCHWELLE}`),
        el('span', {}, text(k.text)));
    });
    return el('section', { class: `karte fortschritt-bereich ${b.id.toLowerCase()}` },
      el('h3', {}, b.titel),
      el('div', { class: 'tabelle-rollen' }, el('table', { class: 'tabelle' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Niveau'), el('th', {}, 'Medaille'), el('th', {}, 'Bestwert'), el('th', {}, 'Runden'))),
        el('tbody', {}, zeilen))),
      kannListe.length ? el('h4', {}, 'Das kann ich schon') : null,
      kannListe.length ? el('p', { class: 'tipp' }, `✓ heißt: ${KANN_SCHWELLE} passende Aufgaben gleich beim ersten Versuch richtig.`) : null,
      kannListe.length ? el('ul', { class: 'kann-liste' }, kannListe) : null);
  };

  const normale = p.runden.filter((r) => r.art === 'normal');
  const letzteCodes = normale.map((r, i) => ({ r, code: codeVonRunde(name, p, r, i) })).slice(-20).reverse();
  const codeListe = letzteCodes.length ? el('section', { class: 'karte' },
    el('h3', {}, 'Meine Punktecodes'),
    el('p', { class: 'leise' }, 'Die letzten Runden. Tippe auf „Kopieren“, wenn du einen Code noch nicht abgegeben hast.'),
    el('ul', { class: 'code-liste' }, letzteCodes.map(({ r, code }) => {
      const t = el('span', { class: 'code' }, code);
      return el('li', {},
        el('span', { class: 'code-info' }, `${datumVonTag(r.tag)} · ${r.bereich} ${sterneText(r.niveau)} · ${r.punkte} P.`),
        t,
        el('button', { type: 'button', class: 'knopf knopf-klein', 'aria-label': `Code vom ${datumVonTag(r.tag)} kopieren`, onclick: async (e) => {
          const ok = await inZwischenablage(code, t);
          e.currentTarget.textContent = ok ? '✓ Kopiert' : 'Lange drücken';
        } }, 'Kopieren'));
    }))) : null;

  zeigen(
    el('section', { class: 'karte' },
      el('h3', {}, 'Mein Wochenziel'),
      el('p', { class: 'leise' }, 'Wie viele Runden willst du pro Woche schaffen?'),
      zielWahl,
      el('h4', {}, 'Meine Stempel'),
      wochen,
      el('p', { class: 'leise' }, `Insgesamt ${normale.length} Runden geübt · ${p.ausgebessert} Fehler endgültig ausgebessert`),
      el('p', { class: 'tipp' }, 'Medaillen pro Niveau: Bronze ab 40 Punkten, Silber ab 60, Gold ab 75 in einer Runde.')),
    ...frei.map(bereichsBlock),
    !frei.length ? el('p', { class: 'leise' }, 'Noch keine Bereiche frei.') : null,
    codeListe);
}

// ---------- Start ----------

async function start() {
  symboleEinfuegen();
  offlineEinrichten();
  dauerhaftBitten();
  daten = await allesLaden();
  fachwoerterSetzen(daten.fachwoerter);
  if (geraet().ton === undefined) { /* Ton bleibt aus */ }
  werUebt();
}

start();
