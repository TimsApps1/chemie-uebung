// Start der App (Etappe 0: Grundgerüst).
import { VERSION } from './version.js';
import { dauerhaftBitten } from './speicher.js';

const inhalt = document.getElementById('inhalt');

document.getElementById('version').textContent = `Version ${VERSION}`;

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

function alsAppGestartet() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

// ---------- Offline-Speicher und "Neue Version" ----------

let nutzerWillUpdate = false;

function updateAnbieten(worker) {
  const hinweis = document.getElementById('update-hinweis');
  const knopf = document.getElementById('update-knopf');
  hinweis.hidden = false;
  knopf.onclick = () => {
    nutzerWillUpdate = true;
    knopf.disabled = true;
    knopf.textContent = 'Lädt …';
    worker.postMessage('jetzt-aktualisieren');
  };
}

async function offlineEinrichten() {
  if (!('serviceWorker' in navigator)) return false;
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
    // Die App bleibt auf dem iPad oft lange offen: beim Zurückkehren nach Neuem schauen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    await navigator.serviceWorker.ready;
    return true;
  } catch {
    return false;
  }
}

async function offlineBereit() {
  try {
    return Boolean(await caches.match('lib/three.module.min.js', { ignoreSearch: true }));
  } catch {
    return false;
  }
}

// ---------- Daten laden ----------

async function datenLaden() {
  const antwort = await fetch('daten/app.json');
  if (!antwort.ok) throw new Error('Die Datei daten/app.json fehlt.');
  return antwort.json();
}

// ---------- Startseite (vorläufig) ----------

function zeile(liste, ok, text) {
  const li = el('li', ok ? 'status-ok' : 'status-offen');
  li.append(el('span', 'status-zeichen', ok ? '✓' : '✗'), el('span', '', text));
  liste.append(li);
}

async function start() {
  let daten;
  try {
    daten = await datenLaden();
  } catch (e) {
    inhalt.replaceChildren(el('p', 'fehler-kasten', 'Die Daten konnten nicht geladen werden. ' + e.message));
    return;
  }

  const karte = el('section', 'karte');
  karte.append(el('h2', '', daten.titel), el('p', '', daten.begruessung));

  const liste = el('ul', 'status-liste');
  karte.append(el('h3', '', 'Technik-Check'), liste);
  inhalt.replaceChildren(karte);

  const swDa = await offlineEinrichten();
  zeile(liste, swDa && await offlineBereit(), swDa ? 'Offline bereit' : 'Offline nicht möglich');

  const app = alsAppGestartet();
  zeile(liste, app, app ? 'Als App vom Home-Bildschirm gestartet' : 'Noch im Safari-Fenster');
  if (!app) {
    karte.append(el('p', 'tipp',
      'Tipp: Tippe oben auf Teilen ⬆ und dann auf „Zum Home-Bildschirm“. Dann bleiben deine Punkte sicher gespeichert.'));
  }

  const dauerhaft = await dauerhaftBitten();
  zeile(liste, dauerhaft === true,
    dauerhaft === true ? 'Speicher dauerhaft' : 'Speicher nicht dauerhaft zugesagt');

  const knopf3d = el('button', 'knopf', '3D-Test anzeigen');
  knopf3d.type = 'button';
  const buehne = el('div', 'buehne-test');
  buehne.hidden = true;
  knopf3d.onclick = async () => {
    knopf3d.disabled = true;
    buehne.hidden = false;
    try {
      const { bausteinTest } = await import('./baustein-test.js');
      bausteinTest(buehne);
      knopf3d.hidden = true;
    } catch (e) {
      buehne.replaceChildren(el('p', 'fehler-kasten', '3D geht auf diesem Gerät nicht: ' + e.message));
    }
  };
  karte.append(knopf3d, buehne);
}

start();
