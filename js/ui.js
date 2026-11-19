// Bausteine der Oberfläche: Symbole, Kopfzeile, Fenster, Vorlesen, Ton, Fachwörter.
import { el, formelKnoten, vorlesbar } from './hilfen.js';
import { geraet, geraetAendern } from './profil.js';

// ---------- Symbole (SVG) ----------

const SYMBOLE = `
<symbol id="i-kolben" viewBox="0 0 48 48"><path d="M17 5h14M20.5 5v13.5L8.4 39.2A3 3 0 0 0 11 43.7h26a3 3 0 0 0 2.6-4.5L27.5 18.5V5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M13.6 30h20.8l4.4 8.4a2 2 0 0 1-1.8 2.9H11a2 2 0 0 1-1.8-2.9z" fill="currentColor"/><circle cx="21" cy="24" r="2" fill="currentColor"/><circle cx="26" cy="20" r="1.4" fill="currentColor"/></symbol>
<symbol id="i-laut" viewBox="0 0 24 24"><path d="M4 9h3.5L13 4.5v15L7.5 15H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-stumm" viewBox="0 0 24 24"><path d="M4 9h3.5L13 4.5v15L7.5 15H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-birne" viewBox="0 0 24 24"><path d="M12 2.8a6.3 6.3 0 0 0-3.7 11.4c.7.5 1.2 1.3 1.2 2.2v.6h5v-.6c0-.9.5-1.7 1.2-2.2A6.3 6.3 0 0 0 12 2.8z" fill="currentColor"/><path d="M9.5 19.2h5M10.5 21.6h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-kopie" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5 15.5V5.5A2.5 2.5 0 0 1 7.5 3H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
<symbol id="i-haus" viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
<symbol id="i-pokal" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 6H4.5a3 3 0 0 0 3 4M17 6h2.5a3 3 0 0 1-3 4M12 14v4M8 20.5h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-schloss" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol>
<symbol id="i-zurueck" viewBox="0 0 24 24"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-schluessel" viewBox="0 0 24 24"><circle cx="8" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 12h9M18 12v3.5M15.5 12v2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
<symbol id="i-person" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z" fill="currentColor"/></symbol>
<symbol id="b-lupe" viewBox="0 0 48 48"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="4"/><path d="M29 29l11 11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><text x="20" y="25.5" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="15" font-weight="800" fill="currentColor">H₂</text></symbol>
<symbol id="b-flamme" viewBox="0 0 48 48"><path d="M25 4c1.5 7.5 11 11.5 11 23a12 12 0 0 1-24 0c0-6.5 3.6-9.2 5.2-14 1.3 3.4 3.2 5 5 5.4C21.2 13 22 8 25 4z" fill="currentColor"/><path d="M24.5 28c.8 3.4 5 5 5 9.5a5.5 5.5 0 0 1-11 0c0-2.8 1.8-4.2 2.6-6.4.7 1.3 1.6 2 2.5 2.1-.4-1.9 0-3.6.9-5.2z" fill="rgba(0,0,0,.25)"/></symbol>
<symbol id="b-baustein" viewBox="0 0 48 48"><rect x="6" y="18" width="36" height="22" rx="4" fill="currentColor"/><rect x="11" y="11" width="9" height="8" rx="2" fill="currentColor"/><rect x="28" y="11" width="9" height="8" rx="2" fill="currentColor"/><path d="M9 35h30" stroke="rgba(0,0,0,.22)" stroke-width="3"/></symbol>
<symbol id="b-waage" viewBox="0 0 48 48"><path d="M24 7v33M14 42h20M7 13h34" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M11 13 5 27h12zM37 13l-6 14h12z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 27a7 4 0 0 0 14 0zM30 27a7 4 0 0 0 14 0z" fill="currentColor"/><circle cx="24" cy="7" r="3" fill="currentColor"/></symbol>`;

export function symboleEinfuegen() {
  if (document.getElementById('symbole')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'symbole';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  svg.innerHTML = SYMBOLE;
  document.body.prepend(svg);
}

export function icon(name, klasse = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  if (klasse) svg.setAttribute('class', klasse);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + name);
  svg.append(use);
  return svg;
}

export function iconKnopf(name, label, onclick, klasse = 'knopf-rund knopf-leise') {
  return el('button', { type: 'button', class: `knopf ${klasse}`, 'aria-label': label, title: label, onclick }, icon(name));
}

// ---------- Element-Baustein (flach) ----------

export function baustein(symbol, { metall = false, noppen = 0, klein = false } = {}) {
  const b = el('span', {
    class: `baustein el-${symbol}${metall ? ' metall' : ''}${klein ? ' baustein-klein' : ''}`,
    style: `--noppen:${Math.max(noppen, 1)}`
  });
  if (noppen > 0) {
    const n = el('span', { class: 'noppen' });
    for (let i = 0; i < noppen; i++) n.append(el('i'));
    b.append(n);
  }
  b.append(el('b', {}, symbol));
  return b;
}

// ---------- Kopfzeile ----------

const kopf = () => document.querySelector('.kopf');

export function kopfSetzen({ titel = 'Chemie üben', farbe = null, links = null, rechts = [] } = {}) {
  const k = kopf();
  k.style.background = farbe ? `var(--${farbe})` : '';
  k.style.setProperty('--kopf-kante', farbe ? `var(--${farbe}-dunkel)` : 'var(--haupt-dunkel)');
  k.replaceChildren(
    links || icon('i-kolben', 'kopf-logo'),
    el('h1', { class: 'kopf-titel' }, titel),
    ...rechts,
    tonKnopf()
  );
}

function tonKnopf() {
  const an = geraet().ton;
  return el('button', {
    type: 'button', class: 'knopf knopf-rund kopf-knopf',
    'aria-label': an ? 'Ton ist an. Tippen zum Ausschalten.' : 'Ton ist aus. Tippen zum Einschalten.',
    title: an ? 'Ton an' : 'Ton aus',
    onclick: (e) => {
      const g = geraetAendern((x) => { x.ton = !x.ton; });
      e.currentTarget.replaceWith(tonKnopf());
      if (g.ton) tonSpielen(true);
    }
  }, icon(an ? 'i-laut' : 'i-stumm'));
}

// ---------- Ton (nur wenn eingeschaltet) ----------

let audio = null;
export function tonSpielen(richtig) {
  if (!geraet().ton) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const jetzt = audio.currentTime;
    const toene = richtig ? [523, 784] : [330, 262];
    toene.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, jetzt + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, jetzt + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, jetzt + i * 0.12 + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(jetzt + i * 0.12);
      o.stop(jetzt + i * 0.12 + 0.25);
    });
  } catch { /* kein Ton möglich */ }
}

// ---------- Vorlesen ----------

let deutscheStimme = null;
function stimmeSuchen() {
  try {
    const stimmen = window.speechSynthesis.getVoices();
    deutscheStimme = stimmen.find((s) => s.lang === 'de-DE' && s.localService) ||
      stimmen.find((s) => s.lang && s.lang.startsWith('de')) || null;
  } catch { deutscheStimme = null; }
}
if ('speechSynthesis' in window) {
  stimmeSuchen();
  window.speechSynthesis.addEventListener?.('voiceschanged', stimmeSuchen);
}

export function vorlesen(text) {
  if (!('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(vorlesbar(text));
    s.lang = 'de-DE';
    s.rate = 0.9;
    if (deutscheStimme) s.voice = deutscheStimme;
    window.speechSynthesis.speak(s);
    return true;
  } catch {
    return false;
  }
}
export function vorlesenStoppen() {
  try { window.speechSynthesis?.cancel(); } catch { /* egal */ }
}

export function vorlesenKnopf(textOderFunktion) {
  return iconKnopf('i-laut', 'Vorlesen', () => {
    vorlesen(typeof textOderFunktion === 'function' ? textOderFunktion() : textOderFunktion);
  });
}

// ---------- Fenster (Erklärung, Fachwort, Rückfrage) ----------

// Fenster können übereinanderliegen (z. B. Fachwort im Erklär-Fenster).
// Schließen bringt das vorherige Fenster und den Fokus zurück.
const fensterStapel = [];
let fensterNr = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fensterStapel.length) fensterStapel[fensterStapel.length - 1].schliessen();
});

export function fenster(inhalt, { knoepfe = null, titel = null } = {}) {
  const ausloeser = document.activeElement;
  const titelId = `fenster-titel-${++fensterNr}`;
  const eintrag = {};
  const schliessen = () => {
    const i = fensterStapel.indexOf(eintrag);
    if (i < 0) return;
    fensterStapel.splice(i, 1);
    hg.remove();
    vorlesenStoppen();
    const darunter = fensterStapel[fensterStapel.length - 1];
    if (darunter) darunter.hg.hidden = false;
    if (ausloeser && document.contains(ausloeser)) ausloeser.focus({ preventScroll: true });
  };
  const box = el('div', { class: 'fenster karte', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titel ? titelId : null, 'aria-label': titel ? null : 'Hinweis' },
    titel ? el('h2', { class: 'fenster-titel', id: titelId }, titel) : null,
    inhalt,
    el('div', { class: 'fenster-knoepfe' },
      knoepfe ? knoepfe(schliessen) : el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: schliessen }, 'Schließen'))
  );
  const hg = el('div', {
    class: 'fenster-hintergrund',
    onclick: (e) => { if (e.target === hg) schliessen(); }
  }, box);
  const oben = fensterStapel[fensterStapel.length - 1];
  if (oben) oben.hg.hidden = true;
  Object.assign(eintrag, { hg, schliessen });
  fensterStapel.push(eintrag);
  document.body.append(hg);
  (box.querySelector('.fenster-knoepfe button') || box.querySelector('button'))?.focus({ preventScroll: true });
  return schliessen;
}

export function fragen(text, jaText, neinText) {
  return new Promise((ok) => {
    fenster(el('p', { class: 'fenster-text' }, text), {
      knoepfe: (zu) => [
        el('button', { type: 'button', class: 'knopf', onclick: () => { zu(); ok(false); } }, neinText),
        el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => { zu(); ok(true); } }, jaText)
      ]
    });
  });
}

// ---------- Text mit Fachwörtern und Formeln ----------

let fachwortListe = [];
let fachwortMuster = null;

export function fachwoerterSetzen(liste) {
  fachwortListe = liste;
  const formen = liste.flatMap((w) => (w.formen?.length ? w.formen : [w.wort]))
    .flatMap((f) => [f, f[0].toUpperCase() + f.slice(1)])
    .filter((f, i, alle) => alle.indexOf(f) === i)
    .sort((a, b) => b.length - a.length)
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  fachwortMuster = formen.length
    ? new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${formen.join('|')})(?=$|[^A-Za-zÄÖÜäöüß])`, 'g')
    : null;
}

function fachwortZeigen(eintrag) {
  const kopfzeile = [eintrag.artikel ? `${eintrag.artikel} ${eintrag.wort}` : eintrag.wort,
    eintrag.mehrzahl ? `, ${eintrag.mehrzahl}` : ''].join('');
  fenster(el('div', {},
    el('p', { class: 'fachwort-kopf' }, kopfzeile),
    el('p', { class: 'fenster-text' }, formelKnoten(eintrag.erklaerung)),
    el('div', { class: 'zeile-rechts' }, vorlesenKnopf(`${kopfzeile}. ${eintrag.erklaerung}`))
  ));
}

// Text -> Knoten: Formeln tiefgestellt, Fachwörter unterstrichen und antippbar.
export function text(roh) {
  const frag = document.createDocumentFragment();
  const s = String(roh ?? '');
  if (!fachwortMuster) { frag.append(formelKnoten(s)); return frag; }
  let letzte = 0;
  fachwortMuster.lastIndex = 0;
  let m;
  while ((m = fachwortMuster.exec(s))) {
    const start = m.index + m[1].length;
    frag.append(formelKnoten(s.slice(letzte, start)));
    const wort = m[2];
    const klein = (x) => x[0].toLowerCase() + x.slice(1);
    const eintrag = fachwortListe.find((w) => (w.formen?.length ? w.formen : [w.wort]).some((f) => f === wort || klein(f) === klein(wort)));
    frag.append(el('button', {
      type: 'button', class: 'fachwort',
      onclick: (e) => { e.stopPropagation(); fachwortZeigen(eintrag); }
    }, wort));
    letzte = start + wort.length;
  }
  frag.append(formelKnoten(s.slice(letzte)));
  return frag;
}

// ---------- Hinweis bei fehlerhaften Daten ----------

export function datenFehlerKasten(fehlerListe) {
  if (!fehlerListe.length) return null;
  return el('details', { class: 'daten-fehler' },
    el('summary', {}, `⚠ Hinweis für die Lehrkraft: ${fehlerListe.length} Problem${fehlerListe.length === 1 ? '' : 'e'} in den Daten`),
    el('ul', {}, fehlerListe.map((f) =>
      el('li', {}, el('b', {}, f.datei + (f.zeile ? `, Zeile ${f.zeile}` : '')), ': ', f.text)))
  );
}
