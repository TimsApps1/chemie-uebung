// 3D-Modell einer Formel aus Steinen OHNE Noppen (Bereich 4: Atome zählen).
// Ein einziger Zeichenbereich wird wiederverwendet (alte iPads, Safari-Grenzen).
import * as THREE from '../lib/three.module.min.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { formelZerlegen } from './hilfen.js';

let renderer = null;
let szene, kamera, steuerung;
const texturen = new Map();

function farbe(symbol, art) {
  const wert = getComputedStyle(document.documentElement).getPropertyValue(`--el-${symbol}${art}`).trim();
  return wert || (art === '-text' ? '#ffffff' : '#7a8296');
}

function symbolTextur(symbol) {
  if (texturen.has(symbol)) return texturen.get(symbol);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = farbe(symbol, '');
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = farbe(symbol, '-text');
  g.font = '800 104px -apple-system, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, 128, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texturen.set(symbol, t);
  return t;
}

// Reihenfolge so mischen, dass gleiche Elemente möglichst nicht nebeneinander stehen.
function abwechselnd(atome) {
  const rest = { ...atome };
  const folge = [];
  let letztes = null;
  const gesamt = Object.values(rest).reduce((a, b) => a + b, 0);
  for (let i = 0; i < gesamt; i++) {
    const kandidaten = Object.entries(rest).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const wahl = kandidaten.find(([s]) => s !== letztes) || kandidaten[0];
    folge.push(wahl[0]);
    rest[wahl[0]] -= 1;
    letztes = wahl[0];
  }
  return folge;
}

function einrichten() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xeef0f8);
  kamera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.enablePan = false;
  steuerung.addEventListener('change', zeichnen);
}

function zeichnen() {
  if (renderer && szene) renderer.render(szene, kamera);
}

function aufraeumen() {
  if (!szene) return;
  szene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) [].concat(o.material).forEach((m) => { if (!m.map) m.dispose(); });
  });
  szene = null;
}

// Zeigt die Formel (z. B. "2 H2O") im Element `ziel`.
export function formelModell(ziel, formel, { hoehe = 230 } = {}) {
  if (!renderer) einrichten();
  aufraeumen();
  const { faktor, atome } = formelZerlegen(formel);
  szene = new THREE.Scene();
  szene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 2.4));
  const licht = new THREE.DirectionalLight(0xffffff, 1.1);
  licht.position.set(3, 6, 5);
  szene.add(licht);

  const form = new THREE.BoxGeometry(1.5, 0.9, 0.9);
  const folge = abwechselnd(atome);
  const proReihe = Math.min(folge.length, 5);
  const gruppe = new THREE.Group();
  for (let t = 0; t < faktor; t++) {
    folge.forEach((symbol, i) => {
      const seite = new THREE.MeshLambertMaterial({ color: farbe(symbol, '') });
      const mitSymbol = new THREE.MeshLambertMaterial({ map: symbolTextur(symbol) });
      const stein = new THREE.Mesh(form, [mitSymbol, mitSymbol, seite, seite, mitSymbol, mitSymbol]);
      const spalte = i % proReihe;
      const reihe = Math.floor(i / proReihe);
      // Leicht versetzt wie eine Mauer, damit es nach Bausteinen aussieht.
      stein.position.set(spalte * 1.56 + (reihe % 2) * 0.4, -reihe * 0.95, -t * 2.2);
      gruppe.add(stein);
    });
  }
  // Teilchen bei "2 H2O" nebeneinander statt hintereinander, wenn Platz ist.
  if (faktor > 1) {
    gruppe.children.forEach((s, idx) => {
      const t = Math.floor(idx / folge.length);
      s.position.z = 0;
      s.position.y -= t * (Math.ceil(folge.length / proReihe) * 0.95 + 0.8);
    });
  }
  const box = new THREE.Box3().setFromObject(gruppe);
  const mitte = box.getCenter(new THREE.Vector3());
  gruppe.position.sub(mitte);
  szene.add(gruppe);

  const breite = ziel.clientWidth || 320;
  renderer.setSize(breite, hoehe);
  kamera.aspect = breite / hoehe;
  const groesse = box.getSize(new THREE.Vector3());
  const noetig = Math.max(groesse.x / kamera.aspect, groesse.y) * 1.25 + 1.2;
  const abstand = noetig / (2 * Math.tan((kamera.fov * Math.PI) / 360)) + groesse.z;
  kamera.position.set(abstand * 0.25, abstand * 0.3, abstand);
  kamera.updateProjectionMatrix();
  steuerung.target.set(0, 0, 0);
  steuerung.minDistance = abstand * 0.5;
  steuerung.maxDistance = abstand * 2;
  steuerung.update();

  ziel.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', `3D-Modell von ${formel}. Mit einem Finger drehen.`);
  zeichnen();
}
