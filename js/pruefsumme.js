// Einfache, selbst geschriebene Prüfsumme (FNV-1a), keine Verschlüsselung.
// Sie schützt nur vor Tippfehlern und einfachem Schummeln. Das Geheimwort steht
// im öffentlichen Quelltext – das ist bekannt und in Kauf genommen.

export const GEHEIM = 'Berzelius-1814-Oetzi-Kupferbeil';

// Zeichen ohne Verwechslungsgefahr: keine 0/O, keine 1/I/L.
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Durchmischen, damit ähnliche Texte sehr verschiedene Ergebnisse geben.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function pruefzeichen(text, laenge) {
  let h = fnv1a(GEHEIM + '|' + text);
  let aus = '';
  for (let i = 0; i < laenge; i++) {
    if (i > 0 && i % 6 === 0) h = fnv1a(GEHEIM + '|' + text + '|' + i);
    aus += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
  }
  return aus;
}

// Eingaben vereinheitlichen: Groß/klein und Leerzeichen egal.
export function eingabeSaeubern(text) {
  return String(text || '').toUpperCase().replace(/\s+/g, '');
}
