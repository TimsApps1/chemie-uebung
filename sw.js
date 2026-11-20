// Offline-Speicher der App ("Service Worker").
// Bei jeder Änderung an der App VERSION erhöhen (gleiche Zahl wie in js/version.js).
const VERSION = 8;
const APP_CACHE = `chemie-app-v${VERSION}`;
const DATEN_CACHE = 'chemie-daten';

// Alle Dateien, die die App zum Starten braucht. Neue Dateien hier eintragen
// (der Test meldet, wenn eine fehlt).
const APP_DATEIEN = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/admin.js',
  'js/aufgaben.js',
  'js/codes.js',
  'js/daten.js',
  'js/erzeugen.js',
  'js/hilfen.js',
  'js/modell3d.js',
  'js/profil.js',
  'js/pruefsumme.js',
  'js/runde.js',
  'js/speicher.js',
  'js/ui.js',
  'js/version.js',
  'lib/three.core.min.js',
  'lib/three.module.min.js',
  'lib/OrbitControls.js',
  'bilder/icon-180.png',
  'bilder/icon-192.png',
  'bilder/icon-512.png'
];

// Dateien, die die Lehrkraft auf github.com ändert. Sie werden beim Start
// frisch geholt (wenn Internet da ist), sonst kommt die gespeicherte Fassung.
const DATEN_DATEIEN = [
  'daten/app.json',
  'daten/bereiche.json',
  'daten/elemente.json',
  'daten/reihe.json',
  'daten/fachwoerter.json',
  'daten/aufgaben/b3.json',
  'daten/aufgaben/b4.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await app.addAll(APP_DATEIEN.map((url) => new Request(url, { cache: 'no-cache' })));
    const daten = await caches.open(DATEN_CACHE);
    await daten.addAll(DATEN_DATEIEN.map((url) => new Request(url, { cache: 'no-cache' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((n) => n.startsWith('chemie-app-') && n !== APP_CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'jetzt-aktualisieren') self.skipWaiting();
  if (event.data === 'version?' && event.source) event.source.postMessage({ swVersion: VERSION });
});

function istDaten(url) {
  return url.pathname.includes('/daten/') && url.pathname.endsWith('.json');
}

// Daten: erst Internet versuchen (höchstens 3 Sekunden), sonst gespeicherte Fassung.
async function datenHolen(request) {
  const cache = await caches.open(DATEN_CACHE);
  const ohneSuche = request.url.split('?')[0];
  try {
    const antwort = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise((_, nein) => setTimeout(() => nein(new Error('zu langsam')), 3000))
    ]);
    if (antwort.ok) {
      await cache.put(ohneSuche, antwort.clone());
      return antwort;
    }
    throw new Error('Antwort ' + antwort.status);
  } catch (e) {
    const alt = await cache.match(ohneSuche);
    if (alt) return alt;
    throw e;
  }
}

// App-Dateien und Bilder: erst gespeicherte Fassung, sonst Internet (und merken).
async function appHolen(request) {
  const treffer = await caches.match(request, { ignoreSearch: true });
  if (treffer) return treffer;
  if (request.mode === 'navigate') {
    const start = await caches.match('index.html');
    if (start) return start;
  }
  const antwort = await fetch(request);
  if (antwort.ok && new URL(request.url).pathname.includes('/bilder/')) {
    const cache = await caches.open(DATEN_CACHE);
    await cache.put(request, antwort.clone());
  }
  return antwort;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(istDaten(url) ? datenHolen(event.request) : appHolen(event.request));
});
