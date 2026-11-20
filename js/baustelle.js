// 3D-Baustelle für Bereich 1: Steine mit Noppen antippen, anstecken, verbinden, lösen.
// Grundidee, die man SEHEN soll: Jede Noppe ist ein Arm für genau eine Bindung.
// Belegte Noppen sind dunkel und gehen direkt in einen Steg zum Partner über,
// freie Noppen sind gelb mit dunklem Rand. Ohne Physik: Positionen nach festem Schema.
// Zusätzlich gibt es eine Liste mit Knöpfen (für VoiceOver, Schaltersteuerung und als Rückfall ohne 3D).
import * as THREE from '../lib/three.module.min.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { el } from './hilfen.js';
import { baustein } from './ui.js';
import {
  leeresModell, kopie, stein, frei, belegt, ersterStein, anstecken, verbinden, loesen, bauErgebnis, formelVon, zaehlen,
  naechsterSchritt
} from './bausteine-logik.js';

const ABSTAND = 2.9;
const STEIN = { b: 1.5, h: 0.9, t: 0.9 };
const NOPPE = { r: 0.18, l: 0.4 };
const SPREIZ = 0.5; // Winkel zwischen den Noppen einer Doppelbindung (Bogenmaß)
const FARBE_STEG = 0x3f4659;
const FARBE_FREI = 0xffd23f;
const FARBE_RAND = 0x1f2433;
const FARBE_WARTET = 0x4f46e5;

function farbe(symbol, art = '') {
  const w = getComputedStyle(document.documentElement).getPropertyValue(`--el-${symbol}${art}`).trim();
  return w || (art === '-text' ? '#ffffff' : '#7a8296');
}

// ---------- Gemeinsame Formen, Materialien und Texturen (einmal anlegen, immer wiederverwenden) ----------

let formen = null;
function formenHolen() {
  if (!formen) {
    formen = {
      stein: new THREE.BoxGeometry(STEIN.b, STEIN.h, STEIN.t),
      noppe: new THREE.CylinderGeometry(NOPPE.r, NOPPE.r, NOPPE.l, 16),
      rand: new THREE.CylinderGeometry(NOPPE.r * 1.32, NOPPE.r * 1.32, NOPPE.l * 0.55, 16),
      steg: new THREE.CylinderGeometry(0.085, 0.085, 1, 8),
      treffer: new THREE.SphereGeometry(0.5, 8, 6)
    };
  }
  return formen;
}

const materialien = new Map();
function material(schluessel, erzeugen) {
  if (!materialien.has(schluessel)) materialien.set(schluessel, erzeugen());
  return materialien.get(schluessel);
}
const lambert = (farbwert, leuchten = 0x000000, staerke = 0) =>
  material(`l|${farbwert}|${leuchten}|${staerke}`, () => new THREE.MeshLambertMaterial({ color: farbwert, emissive: leuchten, emissiveIntensity: staerke }));
const unsichtbar = () => material('unsichtbar', () => new THREE.MeshBasicMaterial({ visible: false }));

const texturen = new Map();
function symbolTextur(text, symbol) {
  const schluessel = `${text}|${symbol}`;
  if (texturen.has(schluessel)) return texturen.get(schluessel);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = farbe(symbol);
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = farbe(symbol, '-text');
  g.font = `800 ${text.length > 3 ? 64 : 100}px -apple-system, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 86);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texturen.set(schluessel, t);
  return t;
}

// ---------- Lage der Steine ----------
// Baum ab dem ersten Stein (Kinder im Fächer), danach kurz „entspannen“:
// Bindungen ziehen auf gleiche Länge, Steine stoßen sich ab. So werden Ringe (Al2O3) rund statt lang.

export function positionen(m) {
  const pos = new Map();
  if (!m.steine.length) return pos;
  const nachbarn = (id) => m.bindungen.filter((b) => b.a === id || b.b === id).map((b) => (b.a === id ? b.b : b.a));
  const besucht = new Set();
  let teil = 0;
  for (const s of m.steine) {
    if (besucht.has(s.id)) continue;
    const start = s.id;
    const glieder = [start];
    pos.set(start, new THREE.Vector3(0, -teil * ABSTAND * 2.4, 0));
    besucht.add(start);
    const schlange = [{ id: start, richtung: null }];
    while (schlange.length) {
      const { id, richtung } = schlange.shift();
      const kinder = nachbarn(id).filter((n) => !besucht.has(n));
      const basis = richtung === null ? 0 : Math.atan2(richtung.y, richtung.x);
      const facher = richtung === null ? Math.PI * 2 : Math.PI * 0.9;
      kinder.forEach((k, i) => {
        const winkel = richtung === null
          ? (i / Math.max(kinder.length, 1)) * facher
          : basis + (kinder.length === 1 ? 0 : (i / (kinder.length - 1) - 0.5) * facher);
        const r = new THREE.Vector3(Math.cos(winkel), Math.sin(winkel), 0);
        pos.set(k, pos.get(id).clone().addScaledVector(r, ABSTAND));
        besucht.add(k);
        glieder.push(k);
        schlange.push({ id: k, richtung: r });
      });
    }
    entspannen(glieder, m, pos);
    teil++;
  }
  return pos;
}

function entspannen(glieder, m, pos) {
  if (glieder.length < 3) return;
  const mitte = pos.get(glieder[0]).clone();
  const kanten = m.bindungen.filter((b) => glieder.includes(b.a) && glieder.includes(b.b));
  for (let runde = 0; runde < 120; runde++) {
    const kraft = new Map(glieder.map((id) => [id, new THREE.Vector3()]));
    for (let i = 0; i < glieder.length; i++) {
      for (let j = i + 1; j < glieder.length; j++) {
        const d = pos.get(glieder[i]).clone().sub(pos.get(glieder[j]));
        const l = Math.max(0.3, d.length());
        const stoss = d.multiplyScalar((ABSTAND * ABSTAND * 0.9) / (l * l * l));
        kraft.get(glieder[i]).add(stoss);
        kraft.get(glieder[j]).sub(stoss);
      }
    }
    for (const k of kanten) {
      const d = pos.get(k.b).clone().sub(pos.get(k.a));
      const l = Math.max(0.3, d.length());
      const zug = d.multiplyScalar(((l - ABSTAND) / l) * 0.5);
      kraft.get(k.a).add(zug);
      kraft.get(k.b).sub(zug);
    }
    for (const id of glieder) pos.get(id).addScaledVector(kraft.get(id).clampLength(0, 0.4), 0.5);
  }
  // Wieder um den ersten Stein zentrieren (damit das Modell nicht wandert).
  const schwerpunkt = glieder.reduce((v, id) => v.add(pos.get(id)), new THREE.Vector3()).divideScalar(glieder.length);
  for (const id of glieder) pos.get(id).sub(schwerpunkt).add(mitte);
}

// ---------- Lage der Noppen ----------
// Jede Bindung belegt an beiden Steinen eine Noppe, die zum Partner zeigt.
// Freie Noppen verteilen sich in den größten Lücken. Ergebnis pro Stein: [{ winkel, partner|null }].

const normal = (w) => ((w % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

export function noppenLage(m, pos) {
  const lage = new Map(m.steine.map((s) => [s.id, []]));
  for (const b of m.bindungen) {
    const pa = pos.get(b.a); const pb = pos.get(b.b);
    if (!pa || !pb) continue;
    const w = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    for (let j = 0; j < b.anzahl; j++) {
      const d = (j - (b.anzahl - 1) / 2) * SPREIZ;
      // Gespiegelte Versätze: die Stege einer Doppelbindung laufen parallel.
      lage.get(b.a).push({ winkel: normal(w + d), partner: b.b, nr: j, bindung: b });
      lage.get(b.b).push({ winkel: normal(w + Math.PI - d), partner: b.a, nr: j, bindung: b });
    }
  }
  for (const s of m.steine) {
    const liste = lage.get(s.id);
    const f = s.wertigkeit - liste.length;
    if (f <= 0) continue;
    if (!liste.length) {
      const start = s.wertigkeit === 2 || s.wertigkeit === 4 ? 0 : Math.PI / 2;
      for (let i = 0; i < f; i++) liste.push({ winkel: normal(start + (i * Math.PI * 2) / s.wertigkeit), partner: null });
      continue;
    }
    const belegtW = liste.map((n) => n.winkel).sort((x, y) => x - y);
    const luecken = belegtW.map((w, i) => ({ von: w, groesse: normal((belegtW[i + 1] ?? belegtW[0] + Math.PI * 2) - w) || Math.PI * 2, n: 0 }));
    for (let i = 0; i < f; i++) luecken.reduce((best, l) => (l.groesse / (l.n + 1) > best.groesse / (best.n + 1) ? l : best)).n++;
    for (const l of luecken) for (let j = 1; j <= l.n; j++) liste.push({ winkel: normal(l.von + (l.groesse * j) / (l.n + 1)), partner: null });
  }
  return lage;
}

// Punkt auf dem Rand des Steins in Richtung winkel (Stein von vorn gesehen: Rechteck b × h).
function randPunkt(winkel) {
  const c = Math.cos(winkel); const s = Math.sin(winkel);
  const t = Math.min(Math.abs(c) > 1e-6 ? (STEIN.b / 2) / Math.abs(c) : Infinity, Math.abs(s) > 1e-6 ? (STEIN.h / 2) / Math.abs(s) : Infinity);
  return new THREE.Vector3(c * t, s * t, 0);
}

// ---------- 3D-Zeichnung ----------

let renderer = null;
let aktiveSteuerung = null;
function rendererHolen() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xeef0f8);
    renderer.domElement.setAttribute('role', 'img');
  }
  return renderer;
}

let kontextVerloren = false;
export function webglMoeglich() {
  if (kontextVerloren) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// Höhe der Bühne: auf dem iPad groß genug für sichere Tipps, auf kleinen Handys kleiner.
export function buehnenHoehe(anteil = 0.42) {
  const h = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
  return Math.round(Math.max(280, Math.min(480, h * anteil)));
}

const noppenWort = (n) => `${n} ${n === 1 ? 'Noppe' : 'Noppen'}`;

// ---------- Die Baustelle ----------
// optionen: { leiste: [steinArt…], modell, nurAnsehen, beiAenderung(modell), ohneZahl }
// ohneZahl: nur das Symbol aufdrucken (Fe statt Fe(III)) – für Aufgaben, bei denen man die Noppen zählen soll.

export function baustelle({ leiste = [], modell = leeresModell(), nurAnsehen = false, beiAenderung = () => {}, hoehe = buehnenHoehe(), ohneZahl = false } = {}) {
  let m = kopie(modell);
  const verlauf = [];
  let gewaehlteArt = null;   // Stein aus der Leiste
  let wartendeNoppe = null;  // erster Stein beim Verbinden
  let loesenModus = false;   // nächster getippter Stein wird gelöst
  const status = el('p', { class: 'bau-status', 'aria-live': 'polite' });
  const zaehler = el('ul', { class: 'bau-zaehler', 'aria-label': 'Freie Noppen pro Stein' });
  const buehne = el('div', { class: 'bau-buehne', style: `height:${hoehe}px` });
  const liste = el('ul', { class: 'bau-liste', 'aria-label': 'Steine im Modell' });
  let mit3d = webglMoeglich();
  const aufschrift = (s) => (ohneZahl ? s.symbol : s.beschriftung);

  const melden = (text, art = '') => { status.textContent = text; status.className = `bau-status ${art}`; };

  function merken() { verlauf.push(kopie(m)); if (verlauf.length > 40) verlauf.shift(); }
  function geaendert() { zeichnen(); beiAenderung(kopie(m)); }

  // ----- Aktionen -----
  function steinGewaehlt(art) {
    if (nurAnsehen) return;
    wartendeNoppe = null;
    loesenModus = false;
    if (!m.steine.length) {
      merken();
      ersterStein(m, art);
      gewaehlteArt = null;
      melden(`${art.beschriftung} liegt in der Mitte. ${naechsterSchritt(m)}`);
      return geaendert();
    }
    gewaehlteArt = gewaehlteArt?.art === art.art ? null : art;
    melden(gewaehlteArt ? `${art.beschriftung} gewählt (${noppenWort(art.wertigkeit)}). Tippe jetzt auf eine gelbe Noppe.` : 'Auswahl aufgehoben.');
    zeichnen();
  }

  // Tipp auf einen Stein oder eine seiner Noppen (beides wirkt gleich: große Tippfläche).
  function steinOderNoppe(id) {
    if (nurAnsehen) return;
    if (loesenModus) return loesenAktion(id);
    if (frei(m, id) < 1) {
      if (wartendeNoppe !== null || gewaehlteArt) return melden(`An ${stein(m, id).beschriftung} ist keine Noppe mehr frei.`, 'warnung');
      return melden(`An ${stein(m, id).beschriftung} sind alle Noppen belegt ✓`);
    }
    if (gewaehlteArt) {
      const art = gewaehlteArt;
      merken();
      const r = anstecken(m, art, id);
      if (!r.ok) { verlauf.pop(); return melden(r.grund, 'warnung'); }
      // Auswahl aufheben: Der nächste Tipp auf einen Stein verbindet (keine Falle mit doppelt angesteckten Steinen).
      gewaehlteArt = null;
      melden(`${art.beschriftung} angesteckt. ${naechsterSchritt(m)}`);
      return geaendert();
    }
    if (wartendeNoppe === null) {
      wartendeNoppe = id;
      melden(`${stein(m, id).beschriftung} gewählt. Tippe jetzt den Stein an, mit dem er sich verbinden soll.`);
      return zeichnen();
    }
    if (wartendeNoppe === id) { wartendeNoppe = null; melden('Auswahl aufgehoben.'); return zeichnen(); }
    merken();
    const r = verbinden(m, wartendeNoppe, id);
    wartendeNoppe = null;
    if (!r.ok) { verlauf.pop(); melden(r.grund, 'warnung'); return zeichnen(); }
    melden(`Verbunden. ${naechsterSchritt(m)}`);
    geaendert();
  }

  function loesenUmschalten() {
    loesenModus = !loesenModus;
    gewaehlteArt = null; wartendeNoppe = null;
    melden(loesenModus ? 'Tippe auf den Stein, den du abnehmen willst.' : 'Lösen beendet.');
    zeichnen();
  }

  function loesenAktion(id) {
    merken();
    const r = loesen(m, id);
    loesenModus = false;
    wartendeNoppe = null;
    if (!r.ok) { verlauf.pop(); melden(r.grund, 'warnung'); return zeichnen(); }
    melden('Stein abgenommen. Mit ↩ Rückgängig holst du ihn zurück.');
    geaendert();
  }

  function rueckgaengig() {
    if (!verlauf.length) return melden('Es gibt nichts zum Rückgängigmachen.');
    m = verlauf.pop();
    loesenModus = false; wartendeNoppe = null; gewaehlteArt = null;
    melden(`Rückgängig gemacht. ${naechsterSchritt(m)}`);
    geaendert();
  }

  // ----- Leiste -----
  const leisteKnoten = el('div', { class: 'bau-leiste', role: 'group', 'aria-label': 'Steine zum Anstecken' },
    leiste.map((art) => el('button', {
      type: 'button', class: 'bau-stein-knopf', 'data-art': art.art, 'aria-pressed': 'false',
      'aria-label': `${art.name}${art.beschriftung !== art.symbol ? ` (${art.beschriftung})` : ''}, ${noppenWort(art.wertigkeit)}`,
      onclick: () => steinGewaehlt(art)
    }, baustein(art.symbol, { metall: art.metall, noppen: art.wertigkeit, klein: true }),
    el('small', {}, art.beschriftung),
    el('small', { class: 'bau-noppenzahl' }, noppenWort(art.wertigkeit)))));

  const loesenKnopf = el('button', { type: 'button', class: 'knopf', 'aria-pressed': 'false', onclick: loesenUmschalten }, '✂ Stein abnehmen');
  const steuerung = nurAnsehen ? null : el('div', { class: 'zeile bau-steuerung' },
    loesenKnopf,
    el('button', { type: 'button', class: 'knopf', onclick: rueckgaengig }, '↩ Rückgängig'));

  // ----- Zähler und Liste (barrierearm) -----
  function zaehlerZeichnen() {
    zaehler.hidden = nurAnsehen || !m.steine.length;
    zaehler.replaceChildren(...m.steine.map((s) => {
      const f = frei(m, s.id);
      return el('li', { class: f ? 'offen' : 'voll' }, el('b', {}, s.beschriftung), ' ', f ? `${f} frei` : '✓');
    }));
  }

  function listeZeichnen() {
    // Fokus merken, damit VoiceOver und Tastatur nach dem Neuzeichnen an derselben Stelle bleiben.
    const aktiv = liste.contains(document.activeElement) ? document.activeElement : null;
    const merkeId = aktiv?.dataset.id; const merkeAktion = aktiv?.dataset.aktion;
    liste.replaceChildren(...m.steine.map((s) => {
      const f = frei(m, s.id);
      const text = nurAnsehen
        ? `${aufschrift(s)}-Stein mit ${noppenWort(s.wertigkeit)}`
        : `${s.beschriftung}: ${f} von ${noppenWort(s.wertigkeit)} frei${s.fest ? ' (Startstein)' : ''}`;
      return el('li', { class: wartendeNoppe === s.id ? 'wartet' : '' },
        baustein(s.symbol, { metall: s.metall, klein: true }),
        el('span', { class: 'bau-liste-text' }, text),
        nurAnsehen ? null : el('span', { class: 'zeile' },
          f > 0 ? el('button', { type: 'button', class: 'knopf knopf-klein', 'data-aktion': 'noppe', 'data-id': s.id, onclick: () => steinOderNoppe(s.id) },
            gewaehlteArt ? `${gewaehlteArt.beschriftung} hier anstecken` : wartendeNoppe === null ? 'Verbinden …' : wartendeNoppe === s.id ? 'Abbrechen' : 'Hiermit verbinden') : null,
          s.fest ? null : el('button', { type: 'button', class: 'knopf knopf-klein', 'data-aktion': 'loesen', 'data-id': s.id, 'aria-label': `${s.beschriftung} abnehmen`, onclick: () => loesenAktion(s.id) }, 'Abnehmen')));
    }));
    if (aktiv && !liste.contains(document.activeElement)) {
      const ziel = liste.querySelector(`[data-id="${merkeId}"][data-aktion="${merkeAktion}"]`)
        || liste.querySelector('button[data-aktion="noppe"]') || leisteKnoten.querySelector('button');
      ziel?.focus();
    }
  }

  // ----- 3D -----
  let szene; let kamera; let steuerungOrbit; let treffer = [];
  const strahl = new THREE.Raycaster();
  if (mit3d) {
    const r = rendererHolen();
    kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    kamera.position.set(0, 2, 14);
    // Nur eine Baustelle gleichzeitig bedient den gemeinsamen Zeichenbereich.
    aktiveSteuerung?.dispose();
    steuerungOrbit = new OrbitControls(kamera, r.domElement);
    aktiveSteuerung = steuerungOrbit;
    steuerungOrbit.enablePan = false;
    steuerungOrbit.minDistance = 4;
    steuerungOrbit.maxDistance = 40;
    steuerungOrbit.addEventListener('change', () => { if (buehne.contains(renderer.domElement)) renderer.render(szene, kamera); });

    // Tippen von Drehen unterscheiden.
    let start = null;
    const zielVon = (e) => {
      const rect = r.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      strahl.setFromCamera(p, kamera);
      return strahl.intersectObjects(treffer, false)[0]?.object.userData || null;
    };
    r.domElement.addEventListener('pointerdown', (e) => {
      if (!buehne.contains(r.domElement)) return;
      start = { x: e.clientX, y: e.clientY };
    });
    r.domElement.addEventListener('pointermove', (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) start = null;
    });
    r.domElement.addEventListener('pointerup', (e) => {
      if (!start || !buehne.contains(r.domElement)) return;
      start = null;
      const z = zielVon(e);
      if (z) steinOderNoppe(z.id);
    });
    // Alte iPads geben WebGL manchmal frei: dann mit der Liste weiterbauen.
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      kontextVerloren = true;
      if (!buehne.contains(r.domElement)) return;
      mit3d = false;
      buehne.replaceChildren(el('p', { class: 'leise' }, '3D ist gerade nicht verfügbar. Baue mit der Liste unten weiter.'));
      wurzel.querySelector('.bau-liste-box').open = true;
    });
  }

  function szeneBauen() {
    const f = formenHolen();
    szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 2.3));
    const licht = new THREE.DirectionalLight(0xffffff, 1.1);
    licht.position.set(3, 6, 8);
    szene.add(licht);
    treffer = [];
    const pos = positionen(m);
    const lage = noppenLage(m, pos);
    const spitzen = new Map(); // "bindung|stein|nr" -> Spitze der belegten Noppe (dort beginnt der Steg)

    for (const s of m.steine) {
      const p = pos.get(s.id);
      const wartet = wartendeNoppe === s.id;
      const leuchten = wartet ? FARBE_WARTET : loesenModus && !s.fest ? 0xc0262d : 0x000000;
      const staerke = wartet ? 0.45 : loesenModus && !s.fest ? 0.35 : 0;
      const seite = lambert(farbe(s.symbol), leuchten, staerke);
      const vorn = material(`t|${aufschrift(s)}|${s.symbol}|${leuchten}|${staerke}`,
        () => new THREE.MeshLambertMaterial({ map: symbolTextur(aufschrift(s), s.symbol), emissive: leuchten, emissiveIntensity: staerke * 0.7 }));
      const k = new THREE.Mesh(f.stein, [seite, seite, seite, seite, vorn, vorn]);
      k.position.copy(p);
      k.userData = { art: 'stein', id: s.id };
      szene.add(k);
      treffer.push(k);
      for (const n of lage.get(s.id)) {
        const richtung = new THREE.Vector3(Math.cos(n.winkel), Math.sin(n.winkel), 0);
        const fuss = p.clone().add(randPunkt(n.winkel));
        const noppe = new THREE.Mesh(f.noppe, n.partner === null
          ? lambert(wartet ? FARBE_WARTET : FARBE_FREI, wartet ? FARBE_WARTET : 0xffb800, 0.35)
          : lambert(FARBE_STEG));
        noppe.position.copy(fuss).addScaledVector(richtung, NOPPE.l / 2);
        noppe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung);
        szene.add(noppe);
        if (n.partner === null) {
          // Dunkler Ring am Fuß: freie Noppen heben sich von jedem Stein und vom Hintergrund ab (nicht nur über Farbe).
          const rand = new THREE.Mesh(f.rand, lambert(FARBE_RAND));
          rand.position.copy(fuss).addScaledVector(richtung, NOPPE.l * 0.2);
          rand.quaternion.copy(noppe.quaternion);
          szene.add(rand);
          const t = new THREE.Mesh(f.treffer, unsichtbar());
          t.position.copy(fuss).addScaledVector(richtung, NOPPE.l);
          t.userData = { art: 'noppe', id: s.id };
          szene.add(t);
          treffer.push(t);
        } else {
          spitzen.set(`${m.bindungen.indexOf(n.bindung)}|${s.id}|${n.nr}`, fuss.clone().addScaledVector(richtung, NOPPE.l));
        }
      }
    }
    // Stege: von der Spitze einer belegten Noppe zur Spitze der Partner-Noppe.
    m.bindungen.forEach((b, i) => {
      for (let j = 0; j < b.anzahl; j++) {
        const pa = spitzen.get(`${i}|${b.a}|${j}`); const pb = spitzen.get(`${i}|${b.b}|${j}`);
        if (!pa || !pb) continue;
        const richtung = pb.clone().sub(pa);
        const steg = new THREE.Mesh(f.steg, lambert(FARBE_STEG));
        steg.scale.set(1, Math.max(0.05, richtung.length()), 1);
        steg.position.copy(pa).addScaledVector(richtung, 0.5);
        steg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.clone().normalize());
        szene.add(steg);
      }
    });
    // Kamera so einstellen, dass alles zu sehen ist.
    const box = new THREE.Box3();
    if (m.steine.length) for (const p of pos.values()) box.expandByPoint(p);
    else box.expandByPoint(new THREE.Vector3(0, 0, 0));
    const mitte = box.getCenter(new THREE.Vector3());
    const groesse = box.getSize(new THREE.Vector3());
    const noetig = Math.max(groesse.x + 3, (groesse.y + 3) * kamera.aspect, 4.6);
    const abstand = Math.min(36, noetig / (2 * Math.tan((kamera.fov * Math.PI) / 360) * kamera.aspect) + 2);
    steuerungOrbit.target.copy(mitte);
    if (kamera.position.distanceTo(mitte) < abstand * 0.8 || kamera.position.distanceTo(mitte) > abstand * 1.6) {
      // Leicht schräg von oben: so sieht man auch die Noppen an den Seiten.
      kamera.position.copy(mitte.clone().add(new THREE.Vector3(abstand * 0.16, abstand * 0.26, abstand)));
    }
    steuerungOrbit.update();
  }

  function zeichnen() {
    leisteKnoten.querySelectorAll('.bau-stein-knopf').forEach((k) => {
      const an = gewaehlteArt?.art === k.dataset.art;
      k.classList.toggle('gewaehlt', an);
      k.setAttribute('aria-pressed', String(an));
    });
    loesenKnopf.classList.toggle('knopf-haupt', loesenModus);
    loesenKnopf.setAttribute('aria-pressed', String(loesenModus));
    zaehlerZeichnen();
    listeZeichnen();
    if (!mit3d) return;
    const r = rendererHolen();
    const breite = buehne.clientWidth || 600;
    r.setSize(breite, hoehe);
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    szeneBauen();
    if (!buehne.contains(r.domElement)) buehne.replaceChildren(r.domElement);
    r.domElement.setAttribute('aria-label', `3D-Modell: ${m.steine.map((s) => (nurAnsehen ? `${aufschrift(s)} mit ${noppenWort(s.wertigkeit)}` : aufschrift(s))).join(', ') || 'noch leer'}. Mit einem Finger drehen.`);
    r.render(szene, kamera);
  }

  if (!mit3d) buehne.replaceChildren(el('p', { class: 'leise' }, 'Auf diesem Gerät gibt es kein 3D. Baue mit der Liste unten.'));
  melden(nurAnsehen ? 'Mit einem Finger drehen, mit zwei Fingern zoomen.' : naechsterSchritt(m));

  const wurzel = el('div', { class: 'baustelle' + (nurAnsehen ? ' nur-ansehen' : '') },
    buehne,
    status,
    zaehler,
    nurAnsehen ? null : leisteKnoten,
    steuerung,
    el('details', { class: 'bau-liste-box', open: !mit3d },
      el('summary', {}, 'Steine als Liste (ohne 3D bauen)'), liste));
  requestAnimationFrame(zeichnen);

  return {
    wurzel,
    melden,
    modell: () => kopie(m),
    setzeModell(neu) { m = kopie(neu); verlauf.length = 0; loesenModus = false; wartendeNoppe = null; gewaehlteArt = null; melden(nurAnsehen ? '' : naechsterSchritt(m)); zeichnen(); },
    sperren() { nurAnsehen = true; melden(''); wurzel.classList.add('gesperrt'); leisteKnoten.remove(); steuerung?.remove(); zeichnen(); },
    entsperren() {
      nurAnsehen = false;
      wurzel.classList.remove('gesperrt');
      melden(naechsterSchritt(m));
      if (!wurzel.contains(leisteKnoten)) zaehler.after(leisteKnoten);
      if (steuerung && !wurzel.contains(steuerung)) leisteKnoten.after(steuerung);
      zeichnen();
    },
    zeichnen,
    ergebnis: (ziel) => bauErgebnis(m, ziel),
    formel: () => (m.steine.length ? formelVon(zaehlen(m)) : ''),
    belegt: (id) => belegt(m, id)
  };
}
