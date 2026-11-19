// Kleiner 3D-Test: ein Sauerstoff-Baustein mit 2 Noppen, mit einem Finger drehbar.
import * as THREE from '../lib/three.module.min.js';
import { OrbitControls } from '../lib/OrbitControls.js';

function symbolTextur(symbol, farbe) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = farbe;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.font = 'bold 72px -apple-system, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function bausteinTest(buehne) {
  const breite = buehne.clientWidth || 300;
  const hoehe = 280;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(breite, hoehe);
  renderer.setClearColor(0xeef1f7);
  buehne.replaceChildren(renderer.domElement);

  const szene = new THREE.Scene();
  szene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const licht = new THREE.DirectionalLight(0xffffff, 1.2);
  licht.position.set(3, 5, 4);
  szene.add(licht);

  const kamera = new THREE.PerspectiveCamera(40, breite / hoehe, 0.1, 100);
  kamera.position.set(2.6, 2.2, 3.4);

  const rot = '#d7263d';
  const seite = new THREE.MeshLambertMaterial({ color: rot });
  const oben = new THREE.MeshLambertMaterial({ map: symbolTextur('O', rot) });
  // Reihenfolge der Seiten: +x, -x, +y, -y, +z, -z
  const stein = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1),
    [seite, seite, seite, seite, oben, seite]);
  szene.add(stein);

  const noppeForm = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 20);
  for (const x of [-0.45, 0.45]) {
    const noppe = new THREE.Mesh(noppeForm, seite);
    noppe.position.set(x, 0.62, 0);
    szene.add(noppe);
  }

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.enablePan = false;
  steuerung.minDistance = 2.5;
  steuerung.maxDistance = 9;

  // Nur zeichnen, wenn sich etwas bewegt (schont alte iPads).
  const zeichnen = () => renderer.render(szene, kamera);
  steuerung.addEventListener('change', zeichnen);
  zeichnen();

  buehne.append(Object.assign(document.createElement('p'), {
    className: 'tipp',
    textContent: 'Mit einem Finger drehen, mit zwei Fingern größer und kleiner machen.'
  }));
}
