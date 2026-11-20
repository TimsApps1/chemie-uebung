// 3D-Baustelle für Bereich 1: Steine mit Noppen antippen, anstecken, verbinden, lösen.
// Ohne Physik: Die Positionen rechnet die App nach einem festen Schema (Stern/Kette).
// Zusätzlich gibt es eine Liste mit Knöpfen (für VoiceOver, Schaltersteuerung und als Rückfall ohne 3D).
import * as THREE from '../lib/three.module.min.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { el } from './hilfen.js';
import { baustein } from './ui.js';
import {
  leeresModell, kopie, stein, frei, belegt, ersterStein, anstecken, verbinden, loesen, bauErgebnis, formelVon, zaehlen
} from './bausteine-logik.js';

const ABSTAND = 2.6;
const STEIN = { b: 1.5, h: 0.9, t: 0.9 };

function farbe(symbol, art = '') {
  const w = getComputedStyle(document.documentElement).getPropertyValue(`--el-${symbol}${art}`).trim();
  return w || (art === '-text' ? '#ffffff' : '#7a8296');
}

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

// Feste Positionen: Baum ab dem ersten Stein, Kinder im Stern um den Elternstein.
export function positionen(m) {
  const pos = new Map();
  if (!m.steine.length) return pos;
  const nachbarn = (id) => m.bindungen.filter((b) => b.a === id || b.b === id).map((b) => (b.a === id ? b.b : b.a));
  const besucht = new Set();
  const teile = [];
  for (const s of m.steine) {
    if (besucht.has(s.id)) continue;
    // Jedes zusammenhängende Teil bekommt einen eigenen Platz (versetzt nach unten).
    const start = s.id;
    const versatz = teile.length * (ABSTAND * 2.2);
    pos.set(start, new THREE.Vector3(0, -versatz, 0));
    besucht.add(start);
    const schlange = [{ id: start, richtung: null }];
    while (schlange.length) {
      const { id, richtung } = schlange.shift();
      const kinder = nachbarn(id).filter((n) => !besucht.has(n));
      const basis = richtung === null ? 0 : Math.atan2(richtung.y, richtung.x);
      const facher = richtung === null ? Math.PI * 2 : Math.PI * 0.9;
      kinder.forEach((k, i) => {
        let winkel;
        if (richtung === null) winkel = (i / Math.max(kinder.length, 1)) * facher;
        else winkel = basis + (kinder.length === 1 ? 0 : (i / (kinder.length - 1) - 0.5) * facher);
        const r = new THREE.Vector3(Math.cos(winkel), Math.sin(winkel), 0);
        pos.set(k, pos.get(id).clone().addScaledVector(r, ABSTAND));
        besucht.add(k);
        schlange.push({ id: k, richtung: r });
      });
    }
    teile.push(start);
  }
  return pos;
}

// ---------- 3D-Zeichnung ----------

let renderer = null;
let aktiveSteuerung = null;
function rendererHolen() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xeef0f8);
  }
  return renderer;
}

export function webglMoeglich() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// ---------- Die Baustelle ----------
// optionen: { leiste: [steinArt…], modell, nurAnsehen, beiAenderung(modell) }

export function baustelle({ leiste = [], modell = leeresModell(), nurAnsehen = false, beiAenderung = () => {}, hoehe = 320 } = {}) {
  let m = kopie(modell);
  const verlauf = [];
  let gewaehlteArt = null;   // Stein aus der Leiste
  let wartendeNoppe = null;  // erster Stein beim Verbinden
  let markiert = null;       // Stein zum Lösen
  const status = el('p', { class: 'bau-status', 'aria-live': 'polite' });
  const buehne = el('div', { class: 'bau-buehne', style: `height:${hoehe}px` });
  const liste = el('ul', { class: 'bau-liste', 'aria-label': 'Steine im Modell' });
  const mit3d = webglMoeglich();

  const melden = (text, art = '') => { status.textContent = text; status.className = `bau-status ${art}`; };

  function merken() { verlauf.push(kopie(m)); if (verlauf.length > 40) verlauf.shift(); }
  function geaendert() { zeichnen(); beiAenderung(kopie(m)); }

  // ----- Aktionen -----
  function steinGewaehlt(art) {
    if (nurAnsehen) return;
    wartendeNoppe = null;
    if (!m.steine.length) {
      merken();
      ersterStein(m, art);
      gewaehlteArt = null;
      melden(`${art.beschriftung} liegt in der Mitte. Wähle den nächsten Stein und tippe auf eine leuchtende Noppe.`);
      return geaendert();
    }
    gewaehlteArt = gewaehlteArt?.art === art.art ? null : art;
    melden(gewaehlteArt ? `${art.beschriftung} gewählt: Tippe auf eine leuchtende Noppe, um ihn anzustecken.` : 'Auswahl aufgehoben.');
    zeichnen();
  }

  function noppeGetippt(id) {
    if (nurAnsehen) return;
    markiert = null;
    if (frei(m, id) < 1) return melden('An diesem Stein ist keine Noppe mehr frei.', 'warnung');
    if (gewaehlteArt) {
      merken();
      const r = anstecken(m, gewaehlteArt, id);
      if (!r.ok) { verlauf.pop(); return melden(r.grund, 'warnung'); }
      melden(`${gewaehlteArt.beschriftung} angesteckt.`);
      return geaendert();
    }
    if (wartendeNoppe === null) {
      wartendeNoppe = id;
      melden(`Noppe an ${stein(m, id).beschriftung} gewählt. Tippe auf eine freie Noppe an einem anderen Stein, um beide zu verbinden.`);
      return zeichnen();
    }
    if (wartendeNoppe === id) { wartendeNoppe = null; melden('Auswahl aufgehoben.'); return zeichnen(); }
    merken();
    const r = verbinden(m, wartendeNoppe, id);
    wartendeNoppe = null;
    if (!r.ok) { verlauf.pop(); melden(r.grund, 'warnung'); return zeichnen(); }
    melden('Verbunden.');
    geaendert();
  }

  function steinGetippt(id) {
    if (nurAnsehen) return;
    markiert = markiert === id ? null : id;
    melden(markiert ? `${stein(m, id).beschriftung} markiert. Tippe auf „Lösen“, um ihn abzunehmen.` : '');
    zeichnen();
  }

  function loesenAktion(id = markiert) {
    if (id === null || id === undefined) return melden('Tippe zuerst auf den Stein, den du lösen willst.', 'warnung');
    merken();
    loesen(m, id);
    markiert = null;
    wartendeNoppe = null;
    melden('Stein gelöst.');
    geaendert();
  }

  function rueckgaengig() {
    if (!verlauf.length) return melden('Es gibt nichts zum Rückgängigmachen.');
    m = verlauf.pop();
    markiert = null; wartendeNoppe = null;
    melden('Rückgängig gemacht.');
    geaendert();
  }

  // ----- Leiste -----
  const leisteKnoten = el('div', { class: 'bau-leiste', role: 'group', 'aria-label': 'Steine zum Anstecken' },
    leiste.map((art) => el('button', {
      type: 'button', class: 'bau-stein-knopf', 'data-art': art.art, 'aria-pressed': 'false',
      'aria-label': `${art.name}${art.beschriftung !== art.symbol ? ` (${art.beschriftung})` : ''}, ${art.wertigkeit} ${art.wertigkeit === 1 ? 'Noppe' : 'Noppen'}`,
      onclick: () => steinGewaehlt(art)
    }, baustein(art.symbol, { metall: art.metall, noppen: art.wertigkeit, klein: true }), el('small', {}, art.beschriftung))));

  const steuerung = nurAnsehen ? null : el('div', { class: 'zeile bau-steuerung' },
    el('button', { type: 'button', class: 'knopf', onclick: () => loesenAktion() }, '✂ Lösen'),
    el('button', { type: 'button', class: 'knopf', onclick: rueckgaengig }, '↩ Rückgängig'));

  // ----- Liste (barrierearm) -----
  function listeZeichnen() {
    liste.replaceChildren(...m.steine.map((s) => {
      const f = frei(m, s.id);
      return el('li', { class: (wartendeNoppe === s.id ? 'wartet ' : '') + (markiert === s.id ? 'markiert' : '') },
        baustein(s.symbol, { metall: s.metall, klein: true }),
        el('span', { class: 'bau-liste-text' }, `${s.beschriftung}: ${f} von ${s.wertigkeit} ${s.wertigkeit === 1 ? 'Noppe' : 'Noppen'} frei`),
        nurAnsehen ? null : el('span', { class: 'zeile' },
          f > 0 ? el('button', { type: 'button', class: 'knopf knopf-klein', 'data-aktion': 'noppe', 'data-id': s.id, onclick: () => noppeGetippt(s.id) },
            gewaehlteArt ? `${gewaehlteArt.beschriftung} hier anstecken` : wartendeNoppe === null ? 'Verbinden …' : wartendeNoppe === s.id ? 'Abbrechen' : 'Hiermit verbinden') : null,
          el('button', { type: 'button', class: 'knopf knopf-klein', 'data-aktion': 'loesen', 'data-id': s.id, onclick: () => loesenAktion(s.id) }, 'Lösen')));
    }));
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

    // Tippen von Drehen unterscheiden; langes Drücken = Lösen (nur Abkürzung).
    let start = null;
    let langTimer = null;
    const zielVon = (e) => {
      const rect = r.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      strahl.setFromCamera(p, kamera);
      const hits = strahl.intersectObjects(treffer, false);
      return hits.sort((a, b) => (a.object.userData.art === 'noppe' ? -1 : 0) - (b.object.userData.art === 'noppe' ? -1 : 0))[0]?.object.userData || null;
    };
    r.domElement.addEventListener('pointerdown', (e) => {
      if (!buehne.contains(r.domElement)) return;
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
      clearTimeout(langTimer);
      langTimer = setTimeout(() => {
        const z = start && zielVon(e);
        if (z?.art === 'stein' && !nurAnsehen) { start = null; loesenAktion(z.id); }
      }, 650);
    });
    r.domElement.addEventListener('pointermove', (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) { clearTimeout(langTimer); start = null; }
    });
    r.domElement.addEventListener('pointerup', (e) => {
      clearTimeout(langTimer);
      if (!start || !buehne.contains(r.domElement)) return;
      start = null;
      const z = zielVon(e);
      if (!z) return;
      if (z.art === 'noppe') noppeGetippt(z.id);
      else if (z.art === 'stein') steinGetippt(z.id);
    });
  }

  function szeneBauen() {
    szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 2.3));
    const licht = new THREE.DirectionalLight(0xffffff, 1.1);
    licht.position.set(3, 6, 8);
    szene.add(licht);
    treffer = [];
    const pos = positionen(m);
    const form = new THREE.BoxGeometry(STEIN.b, STEIN.h, STEIN.t);
    const noppeForm = new THREE.CylinderGeometry(0.17, 0.17, 0.22, 18);
    const trefferForm = new THREE.SphereGeometry(0.42, 10, 8);
    const unsichtbar = new THREE.MeshBasicMaterial({ visible: false });

    for (const s of m.steine) {
      const p = pos.get(s.id);
      const seite = new THREE.MeshLambertMaterial({ color: farbe(s.symbol), emissive: markiert === s.id ? 0x4f46e5 : 0x000000, emissiveIntensity: markiert === s.id ? 0.55 : 0 });
      const mitText = new THREE.MeshLambertMaterial({ map: symbolTextur(s.beschriftung, s.symbol), emissive: markiert === s.id ? 0x4f46e5 : 0x000000, emissiveIntensity: markiert === s.id ? 0.35 : 0 });
      const k = new THREE.Mesh(form, [seite, seite, mitText, seite, mitText, mitText]);
      k.position.copy(p);
      k.userData = { art: 'stein', id: s.id };
      szene.add(k);
      treffer.push(k);
      // Noppen oben: belegte matt, freie leuchten.
      const f = frei(m, s.id);
      for (let i = 0; i < s.wertigkeit; i++) {
        const istFrei = i >= s.wertigkeit - f;
        const x = (i - (s.wertigkeit - 1) / 2) * 0.4;
        const mat = istFrei
          ? new THREE.MeshLambertMaterial({ color: wartendeNoppe === s.id ? 0x4f46e5 : 0xffd23f, emissive: wartendeNoppe === s.id ? 0x4f46e5 : 0xffb800, emissiveIntensity: 0.65 })
          : new THREE.MeshLambertMaterial({ color: farbe(s.symbol) });
        const n = new THREE.Mesh(noppeForm, mat);
        n.position.set(p.x + x, p.y + STEIN.h / 2 + 0.11, p.z);
        szene.add(n);
        if (istFrei) {
          const t = new THREE.Mesh(trefferForm, unsichtbar);
          t.position.copy(n.position);
          t.userData = { art: 'noppe', id: s.id };
          szene.add(t);
          treffer.push(t);
        }
      }
    }
    // Verbindungen als 1–3 Stege
    const stegMat = new THREE.MeshLambertMaterial({ color: 0x5b6279 });
    for (const b of m.bindungen) {
      const pa = pos.get(b.a); const pb = pos.get(b.b);
      if (!pa || !pb) continue;
      const richtung = pb.clone().sub(pa);
      const laenge = Math.max(0.1, richtung.length() - STEIN.b * 0.9);
      const quer = new THREE.Vector3(-richtung.y, richtung.x, 0).normalize();
      for (let i = 0; i < b.anzahl; i++) {
        const versatz = (i - (b.anzahl - 1) / 2) * 0.26;
        const steg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, laenge, 10), stegMat);
        steg.position.copy(pa.clone().add(pb).multiplyScalar(0.5).addScaledVector(quer, versatz));
        steg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.clone().normalize());
        szene.add(steg);
      }
    }
    // Kamera so einstellen, dass alles zu sehen ist.
    const box = new THREE.Box3();
    if (m.steine.length) for (const p of pos.values()) box.expandByPoint(p);
    else box.expandByPoint(new THREE.Vector3(0, 0, 0));
    const mitte = box.getCenter(new THREE.Vector3());
    const groesse = box.getSize(new THREE.Vector3());
    const noetig = Math.max(groesse.x + 3, (groesse.y + 3) * kamera.aspect, 6);
    const abstand = Math.min(36, noetig / (2 * Math.tan((kamera.fov * Math.PI) / 360) * kamera.aspect) + 2);
    steuerungOrbit.target.copy(mitte);
    if (kamera.position.distanceTo(mitte) < abstand * 0.8 || kamera.position.distanceTo(mitte) > abstand * 1.6) {
      kamera.position.copy(mitte.clone().add(new THREE.Vector3(0, abstand * 0.25, abstand)));
    }
    steuerungOrbit.update();
  }

  function zeichnen() {
    // Leiste: gewählten Stein markieren
    leisteKnoten.querySelectorAll('.bau-stein-knopf').forEach((k) => {
      const an = gewaehlteArt?.art === k.dataset.art;
      k.classList.toggle('gewaehlt', an);
      k.setAttribute('aria-pressed', String(an));
    });
    listeZeichnen();
    if (!mit3d) return;
    const r = rendererHolen();
    const breite = buehne.clientWidth || 600;
    r.setSize(breite, hoehe);
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    szeneBauen();
    if (!buehne.contains(r.domElement)) buehne.replaceChildren(r.domElement);
    r.domElement.setAttribute('aria-label', `3D-Modell: ${m.steine.map((s) => s.beschriftung).join(', ') || 'noch leer'}. Mit einem Finger drehen.`);
    r.render(szene, kamera);
  }

  if (!mit3d) buehne.replaceChildren(el('p', { class: 'leise' }, 'Auf diesem Gerät gibt es kein 3D. Baue mit der Liste unten.'));
  melden(nurAnsehen ? 'Mit einem Finger drehen, mit zwei Fingern zoomen.'
    : m.steine.length ? 'Wähle unten einen Stein und tippe auf eine leuchtende Noppe.' : 'Tippe unten auf einen Stein. Er kommt in die Mitte.');

  const wurzel = el('div', { class: 'baustelle' },
    buehne,
    status,
    nurAnsehen ? null : leisteKnoten,
    steuerung,
    el('details', { class: 'bau-liste-box', open: !mit3d },
      el('summary', {}, 'Steine als Liste (ohne 3D bauen)'), liste));
  requestAnimationFrame(zeichnen);

  return {
    wurzel,
    modell: () => kopie(m),
    setzeModell(neu) { m = kopie(neu); verlauf.length = 0; markiert = null; wartendeNoppe = null; zeichnen(); },
    sperren() { nurAnsehen = true; wurzel.classList.add('gesperrt'); leisteKnoten.remove(); steuerung?.remove(); zeichnen(); },
    entsperren() {
      nurAnsehen = false;
      wurzel.classList.remove('gesperrt');
      if (!wurzel.contains(leisteKnoten)) status.after(leisteKnoten);
      if (steuerung && !wurzel.contains(steuerung)) leisteKnoten.after(steuerung);
      zeichnen();
    },
    zeichnen,
    ergebnis: (ziel) => bauErgebnis(m, ziel),
    formel: () => (m.steine.length ? formelVon(zaehlen(m)) : ''),
    belegt: (id) => belegt(m, id)
  };
}
