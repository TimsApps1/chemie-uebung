// QR-Codes: Schüler-iPad zeigt seine Punktecodes, das Lehrer-iPad liest sie mit der Kamera.
// Beide Bibliotheken liegen in lib/ (offline, nichts aus dem Internet).
import { el } from './hilfen.js';
import { fenster, vorlesenKnopf } from './ui.js';

const PRO_SEITE = 6; // wenige Codes pro QR, damit alte iPad-Kameras sie sicher lesen
export const QR_KOPF = 'CHEMIE1';

const geladen = {};
function skriptLaden(src) {
  if (!geladen[src]) {
    geladen[src] = new Promise((ok, nein) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => nein(new Error(`${src} fehlt`));
      document.head.append(s);
    });
  }
  return geladen[src];
}

// Text in Seiten zu je PRO_SEITE Codes aufteilen: "CHEMIE1 1/3 CODE CODE ..."
export function qrSeiten(codes) {
  const seiten = [];
  for (let i = 0; i < codes.length; i += PRO_SEITE) seiten.push(codes.slice(i, i + PRO_SEITE));
  return seiten.map((teil, i) => `${QR_KOPF} ${i + 1}/${seiten.length} ${teil.join(' ')}`);
}

// ---------- Schüler: QR anzeigen ----------

export async function qrZeigen(codes, name) {
  if (!codes.length) {
    fenster(el('p', { class: 'fenster-text' }, 'Du hast noch keine Runden. Spiel erst eine Runde.'), { titel: 'Ergebnisse zeigen' });
    return;
  }
  await skriptLaden('lib/qrcode.js');
  const seiten = qrSeiten(codes);
  let nr = 0;
  const bild = el('img', { class: 'qr-bild', alt: 'QR-Code mit deinen Punktecodes' });
  const info = el('p', { class: 'qr-info', 'aria-live': 'polite' });
  const zurueck = el('button', { type: 'button', class: 'knopf', onclick: () => zeigeSeite(nr - 1) }, '◀');
  const weiter = el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => zeigeSeite(nr + 1) }, 'Nächster ▶');
  function zeigeSeite(i) {
    nr = Math.max(0, Math.min(seiten.length - 1, i));
    const qr = window.qrcode(0, 'M');
    qr.addData(seiten[nr], 'Alphanumeric');
    qr.make();
    bild.src = qr.createDataURL(8, 4);
    info.textContent = seiten.length > 1
      ? `QR ${nr + 1} von ${seiten.length} · Wenn deine Lehrkraft „✓“ sagt, tippe auf „Nächster“.`
      : `${codes.length} ${codes.length === 1 ? 'Runde' : 'Runden'} · Halte das iPad zu deiner Lehrkraft.`;
    zurueck.disabled = nr === 0;
    weiter.disabled = nr === seiten.length - 1;
  }
  zeigeSeite(0);
  fenster(el('div', { class: 'qr-box' },
    el('p', { class: 'leise' }, `${name}: deine Runden der letzten Wochen`),
    bild, info,
    seiten.length > 1 ? el('div', { class: 'zeile qr-blaettern' }, zurueck, weiter) : null,
    el('div', { class: 'zeile-rechts' }, vorlesenKnopf('Halte das iPad zu deiner Lehrkraft. Sie scannt den QR-Code.'))),
  { titel: '📷 Ergebnisse zeigen' });
}

// ---------- Lehrkraft: QR scannen ----------
// gefunden(text) wird für jeden neu erkannten QR-Code aufgerufen und liefert eine kurze Meldung zurück.

export async function qrScannen(gefunden) {
  const meldungen = el('ul', { class: 'scan-meldungen', 'aria-live': 'polite' });
  const status = el('p', { class: 'leise' }, 'Kamera wird gestartet …');
  const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  video.setAttribute('playsinline', '');
  video.muted = true;
  let strom = null;
  let aktiv = true;
  const gesehen = new Set();

  const zu = fenster(el('div', { class: 'scan-box' }, video, status, meldungen), {
    titel: '📷 QR-Codes scannen',
    knoepfe: (schliessen) => [el('button', { type: 'button', class: 'knopf knopf-haupt', onclick: () => { beenden(); schliessen(); } }, 'Fertig')]
  });
  function beenden() {
    aktiv = false;
    strom?.getTracks().forEach((t) => t.stop());
  }
  // Fenster über den Hintergrund geschlossen? Dann Kamera auch aus.
  const beobachter = new MutationObserver(() => { if (!document.contains(video)) { beenden(); beobachter.disconnect(); } });
  beobachter.observe(document.body, { childList: true });

  try {
    await skriptLaden('lib/jsQR.js');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Dieses Gerät erlaubt hier keine Kamera.');
    strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    if (!aktiv) { beenden(); return zu; }
    video.srcObject = strom;
    await video.play().catch(() => {});
    status.textContent = 'Halte die Kamera auf den QR-Code des Kindes.';
  } catch (e) {
    status.textContent = `Die Kamera geht nicht: ${e.message || e.name}. Erlaube die Kamera in den Einstellungen oder nutze „Text einfügen“.`;
    status.className = 'meldung';
    return zu;
  }

  const leinwand = document.createElement('canvas');
  const g = leinwand.getContext('2d', { willReadFrequently: true });
  const schritt = () => {
    if (!aktiv) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const breite = Math.min(800, video.videoWidth);
      const hoehe = Math.round(video.videoHeight * (breite / video.videoWidth));
      leinwand.width = breite;
      leinwand.height = hoehe;
      g.drawImage(video, 0, 0, breite, hoehe);
      const ergebnis = window.jsQR(g.getImageData(0, 0, breite, hoehe).data, breite, hoehe, { inversionAttempts: 'dontInvert' });
      if (ergebnis?.data && !gesehen.has(ergebnis.data)) {
        gesehen.add(ergebnis.data);
        const text = gefunden(ergebnis.data);
        meldungen.prepend(el('li', {}, text));
        if (navigator.vibrate) navigator.vibrate(60);
      }
    }
    setTimeout(() => requestAnimationFrame(schritt), 180);
  };
  schritt();
  return zu;
}
