// Kinder auf diesem iPad, ihre Freischaltungen, Runden und Fortschritt.
// Alles bleibt auf diesem iPad.
import { lesen, schreiben, entfernen } from './speicher.js';
import { tagNummer, wocheVonTag } from './hilfen.js';

export const LIEBLINGSELEMENTE = ['H', 'O', 'C', 'N', 'Cl', 'S', 'Na', 'Mg', 'Al', 'Zn', 'Cu', 'Fe', 'Ag', 'Au'];
const ABSTAENDE = [1, 3, 7]; // Meine Fehler: nach 1 Tag, 3 Tagen, 1 Woche

// ---------- Liste der Kinder ----------

export function kinder() {
  return lesen('kinder', []);
}
function kinderSpeichern(liste) {
  schreiben('kinder', liste);
}
export function kindEintrag(name) {
  return kinder().find((k) => k.name === name) || null;
}

// name = Kurzform (Schlüssel, im Punktecode), anzeige = Schreibweise wie eingegeben.
export function kindAnlegen(name, element, anzeige = name) {
  const liste = kinder();
  if (!liste.some((k) => k.name === name)) {
    liste.push({ name, anzeige: String(anzeige).trim().slice(0, 40), element, gesperrt: false, angelegt: Date.now() });
    kinderSpeichern(liste);
  }
}

export function vorname(name) {
  const k = kindEintrag(name);
  const erstes = (k?.anzeige || '').trim().split(/\s+/)[0];
  return erstes || name;
}

export function anzeigeName(name) {
  const k = kindEintrag(name);
  return k?.anzeige && k.anzeige.toUpperCase() !== name ? `${k.anzeige} (${name})` : name;
}

export function elementAendern(name, element) {
  kinderSpeichern(kinder().map((k) => (k.name === name ? { ...k, element } : k)));
}

export function kindLoeschen(name) {
  kinderSpeichern(kinder().filter((k) => k.name !== name));
  entfernen('kind:' + name);
}

export function kindSperren(name, gesperrt) {
  kinderSpeichern(kinder().map((k) => (k.name === name ? { ...k, gesperrt } : k)));
}

// Umbenennen (Lehrkraft): neuer Kurzname und neuer Klarname. Die Runden behalten ihren alten Code.
export function kindUmbenennen(alt, neu, anzeige = null) {
  if (alt !== neu && kindEintrag(neu)) {
    kinderZusammenfuehren(alt, neu);
  } else if (alt !== neu) {
    kinderSpeichern(kinder().map((k) => (k.name === alt ? { ...k, name: neu, frueher: [...(k.frueher || []), alt] } : k)));
    schreiben('kind:' + neu, lesen('kind:' + alt, null));
    entfernen('kind:' + alt);
  }
  if (anzeige) kinderSpeichern(kinder().map((k) => (k.name === neu ? { ...k, anzeige: anzeige.trim().slice(0, 40) } : k)));
}

// Alle Daten von "von" kommen zu "nach", "von" verschwindet.
export function kinderZusammenfuehren(von, nach) {
  const a = profil(von);
  const b = profil(nach);
  for (const [bereich, kurs] of Object.entries(a.freigeschaltet)) {
    if (kurs === 'E' || !b.freigeschaltet[bereich]) b.freigeschaltet[bereich] = kurs;
  }
  b.runden = [...b.runden, ...a.runden].sort((x, y) => x.zeit - y.zeit);
  b.fehler = { ...a.fehler, ...b.fehler };
  for (const [id, n] of Object.entries(a.kann)) b.kann[id] = (b.kann[id] || 0) + n;
  b.ausgebessert += a.ausgebessert;
  b.stempel = [...new Set([...b.stempel, ...a.stempel])];
  b.geschichteGesehen = { ...a.geschichteGesehen, ...b.geschichteGesehen };
  profilSpeichern(nach, b);
  kinderSpeichern(kinder().filter((k) => k.name !== von));
  entfernen('kind:' + von);
}

// ---------- Profil eines Kindes ----------

function leeresProfil() {
  return {
    freigeschaltet: {},      // { B3: 'G' | 'E' }
    runden: [],              // { bereich, niveau, punkte, ersterVersuch, tag, zeit, art }
    fehler: {},              // { aufgabenId: { bereich, stufe, faellig, inFolge } }
    kann: {},                // { ichKannId: Zahl richtiger Antworten }
    ausgebessert: 0,
    wochenziel: 3,
    stempel: [],             // Wochen, in denen das Wochenziel geschafft wurde
    geschichteGesehen: {},
    letzte: null,            // { bereich, niveau }
    niveauVorschlagAbgelehnt: {},
    abzeichen: []            // schon erreichte Abzeichen (IDs)
  };
}

export function profil(name) {
  return { ...leeresProfil(), ...(lesen('kind:' + name, {}) || {}) };
}

export function profilSpeichern(name, p) {
  schreiben('kind:' + name, p);
}

export function aendern(name, fn) {
  const p = profil(name);
  fn(p);
  profilSpeichern(name, p);
  return p;
}

// ---------- Freischalten ----------

export function freischalten(name, bereich, kurs) {
  return aendern(name, (p) => {
    if (p.freigeschaltet[bereich] !== 'E') p.freigeschaltet[bereich] = kurs;
  });
}

// ---------- Runden ----------

export function rundeSpeichern(name, runde, tag = tagNummer()) {
  return aendern(name, (p) => {
    p.runden.push({ ...runde, tag, zeit: Date.now() });
    if (runde.art === 'normal') p.letzte = { bereich: runde.bereich, niveau: runde.niveau };
    const woche = wocheVonTag(tag);
    if (rundenInWoche(p, woche) >= p.wochenziel && !p.stempel.includes(woche)) p.stempel.push(woche);
  });
}

export function ersteWoche(p) {
  return p.runden.length ? Math.min(...p.runden.map((r) => wocheVonTag(r.tag))) : wocheVonTag(tagNummer());
}

// Rundennummer pro iPad (zählt alle Runden aller Kinder auf diesem Gerät): mit der iPad-Kennung eindeutig.
export function geraetRundenNummer() {
  let n = 0;
  geraetAendern((g) => { g.runden = (g.runden || 0) + 1; n = g.runden; });
  return n;
}

export function naechsteRundenNummer(p) {
  return p.runden.filter((r) => r.art === 'normal').length + 1;
}

// Für Wochenziel und Stempel zählen normale Runden und Fehler-Runden ab 4 Aufgaben.
const zaehltFuerWoche = (r) => r.art === 'normal' || (r.anzahl || 0) >= 4;

// Stempel nachtragen, z. B. wenn das Wochenziel gesenkt wurde.
export function stempelPruefen(name) {
  return aendern(name, (p) => {
    const woche = wocheVonTag(tagNummer());
    if (rundenInWoche(p, woche) >= p.wochenziel && !p.stempel.includes(woche)) p.stempel.push(woche);
  });
}

export function rundenInWoche(p, woche = wocheVonTag(tagNummer())) {
  return p.runden.filter((r) => zaehltFuerWoche(r) && wocheVonTag(r.tag) === woche).length;
}

export function normaleRunden(p, bereich, niveau) {
  return p.runden.filter((r) => r.art === 'normal' && r.bereich === bereich && r.niveau === niveau);
}

export function bestwert(p, bereich, niveau) {
  return normaleRunden(p, bereich, niveau).reduce((m, r) => Math.max(m, r.punkte), 0);
}

// Sterne für ein Niveau: 1 ab 40, 2 ab 60, 3 ab 75 Punkten in einer Runde.
export function sterneFuer(punkte) {
  return punkte >= 75 ? 3 : punkte >= 60 ? 2 : punkte >= 40 ? 1 : 0;
}

// Niveau vorschlagen: die letzten 2 Runden auf diesem Niveau je mindestens 60 Punkte.
// Nur, wenn das nächste Niveau noch kaum geübt ist; nach "Lieber hier bleiben" 3 Runden Ruhe.
export function niveauVorschlag(p, bereich, niveau) {
  if (niveau >= 3) return null;
  if (normaleRunden(p, bereich, niveau + 1).length >= 2) return null;
  const abgelehnt = p.niveauVorschlagAbgelehnt[`${bereich}-${niveau}`];
  if (abgelehnt !== undefined && normaleRunden(p, bereich, niveau).length < abgelehnt + 3) return null;
  const letzte = normaleRunden(p, bereich, niveau).slice(-2);
  if (letzte.length === 2 && letzte.every((r) => r.punkte >= 60)) return niveau + 1;
  return null;
}

// ---------- Meine Fehler ----------

export function fehlerMerken(name, aufgabe, bereich) {
  aendern(name, (p) => {
    p.fehler[aufgabe.id] = { bereich, stufe: 0, faellig: tagNummer() + ABSTAENDE[0], inFolge: 0 };
  });
}

// Antwort bei einer Wiederholung: Zweimal hintereinander richtig = erledigt.
export function fehlerWiederholt(name, id, richtig) {
  let erledigt = false;
  aendern(name, (p) => {
    const f = p.fehler[id];
    if (!f) return;
    if (richtig) {
      f.inFolge += 1;
      if (f.inFolge >= 2) {
        delete p.fehler[id];
        p.ausgebessert += 1;
        erledigt = true;
        return;
      }
      f.stufe = Math.min(f.stufe + 1, ABSTAENDE.length - 1);
    } else {
      f.inFolge = 0;
      f.stufe = 0;
    }
    f.faellig = tagNummer() + ABSTAENDE[f.stufe];
  });
  return erledigt;
}

export function faelligeFehler(p, bereicheFrei) {
  const heute = tagNummer();
  return Object.entries(p.fehler)
    .filter(([, f]) => f.faellig <= heute && bereicheFrei.includes(f.bereich))
    .map(([id, f]) => ({ id, ...f }));
}

// ---------- Ich kann ----------

// Ein Ich-kann-Satz gilt, wenn 6 Aufgaben dazu gleich beim ersten Versuch richtig waren.
export const KANN_SCHWELLE = 6;

export function kannZaehlen(name, kannId) {
  if (!kannId) return;
  aendern(name, (p) => { p.kann[kannId] = (p.kann[kannId] || 0) + 1; });
}

// ---------- Einstellungen dieses iPads ----------

export function geraet() {
  const g = { ton: false, zeitlimitAus: false, serie: 1, ...(lesen('geraet', {}) || {}) };
  if (!g.kennung) {
    // Zwei Zeichen, die dieses iPad im Punktecode kennzeichnen (zufällig beim ersten Start).
    const z = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    g.kennung = z[Math.floor(Math.random() * z.length)] + z[Math.floor(Math.random() * z.length)];
    schreiben('geraet', g);
  }
  return g;
}
export function geraetAendern(fn) {
  const g = geraet();
  fn(g);
  schreiben('geraet', g);
  return g;
}

// ---------- Abzeichen (wenige, nur für Fleiß und Verbesserung) ----------

function rekordeZaehlen(p) {
  const best = {};
  let n = 0;
  for (const r of p.runden.filter((x) => x.art === 'normal')) {
    const k = `${r.bereich}|${r.niveau}`;
    if (k in best && r.punkte > best[k]) n++;
    best[k] = Math.max(best[k] ?? 0, r.punkte);
  }
  return n;
}

export const ABZEICHEN = [
  { id: 'runden10', zeichen: '💪', titel: '10 Runden geübt', ziel: 10, wert: (p) => p.runden.filter((r) => r.art === 'normal').length },
  { id: 'runden25', zeichen: '🏆', titel: '25 Runden geübt', ziel: 25, wert: (p) => p.runden.filter((r) => r.art === 'normal').length },
  { id: 'fehler5', zeichen: '🔧', titel: '5 Fehler endgültig ausgebessert', ziel: 5, wert: (p) => p.ausgebessert },
  { id: 'fehler20', zeichen: '⭐', titel: '20 Fehler endgültig ausgebessert', ziel: 20, wert: (p) => p.ausgebessert },
  { id: 'rekord3', zeichen: '📈', titel: '3-mal den eigenen Rekord verbessert', ziel: 3, wert: rekordeZaehlen },
  { id: 'woche3', zeichen: '📅', titel: '3 Wochenziele geschafft', ziel: 3, wert: (p) => p.stempel.length }
];

export function abzeichenStand(p) {
  return ABZEICHEN.map((a) => {
    const wert = a.wert(p);
    return { ...a, wert: Math.min(wert, a.ziel), erreicht: wert >= a.ziel };
  });
}

// Liefert die seit dem letzten Aufruf neu erreichten Abzeichen und merkt sie sich.
export function neueAbzeichen(name) {
  let neu = [];
  aendern(name, (p) => {
    const schon = new Set(p.abzeichen || []);
    neu = abzeichenStand(p).filter((a) => a.erreicht && !schon.has(a.id));
    p.abzeichen = [...schon, ...neu.map((a) => a.id)];
  });
  return neu;
}

// ---------- Sicherung aller Kinder auf diesem iPad ----------
// Für den Fall, dass ein iPad zurückgesetzt, getauscht oder Safari-Daten gelöscht werden.
// Laden führt zusammen: Nichts Vorhandenes geht verloren, doppelte Runden werden erkannt.

export function ipadSicherungErstellen() {
  const liste = kinder();
  return JSON.stringify({
    art: 'chemie-uebung-ipad', version: 1, erstellt: new Date().toISOString(),
    geraet: geraet(), kinder: liste,
    profile: Object.fromEntries(liste.map((k) => [k.name, profil(k.name)]))
  }, null, 1);
}

export function ipadSicherungGespeichert() {
  geraetAendern((g) => { g.letzteSicherung = Date.now(); });
}

function profileVereinen(b, a) {
  // b = vorhanden, a = aus der Sicherung
  for (const [bereich, kurs] of Object.entries(a.freigeschaltet || {})) {
    if (kurs === 'E' || !b.freigeschaltet[bereich]) b.freigeschaltet[bereich] = kurs;
  }
  const schluessel = (r) => `${r.zeit}|${r.code || ''}|${r.punkte}`;
  const da = new Set(b.runden.map(schluessel));
  const neu = (a.runden || []).filter((r) => !da.has(schluessel(r)));
  b.runden = [...b.runden, ...neu].sort((x, y) => (x.zeit || 0) - (y.zeit || 0));
  b.fehler = { ...(a.fehler || {}), ...b.fehler };
  for (const [id, n] of Object.entries(a.kann || {})) b.kann[id] = Math.max(b.kann[id] || 0, n);
  b.ausgebessert = Math.max(b.ausgebessert || 0, a.ausgebessert || 0);
  b.stempel = [...new Set([...(b.stempel || []), ...(a.stempel || [])])];
  b.abzeichen = [...new Set([...(b.abzeichen || []), ...(a.abzeichen || [])])];
  b.geschichteGesehen = { ...(a.geschichteGesehen || {}), ...b.geschichteGesehen };
  b.zuletzt = b.zuletzt || a.zuletzt;
  b.letzte = b.letzte || a.letzte;
  return neu.length;
}

export function ipadSicherungEinlesen(text) {
  let inhalt;
  try { inhalt = JSON.parse(text); } catch { return { ok: false, grund: 'Die Datei ist keine iPad-Sicherung dieser App.' }; }
  if (inhalt?.art !== 'chemie-uebung-ipad' || !Array.isArray(inhalt.kinder)) {
    return { ok: false, grund: inhalt?.art === 'chemie-uebung-sicherung'
      ? 'Das ist die Sicherung der Lehrkraft-Ergebnisse. Lade sie unter „💾 Sicherung“.'
      : 'Die Datei ist keine iPad-Sicherung dieser App.' };
  }
  const warLeer = !kinder().length;
  let neueKinder = 0; let neueRunden = 0;
  for (const k of inhalt.kinder) {
    if (!k?.name) continue;
    const alt = inhalt.profile?.[k.name] || {};
    if (!kindEintrag(k.name)) {
      kinderSpeichern([...kinder(), { name: k.name, anzeige: k.anzeige || k.name, element: k.element || 'H', gesperrt: Boolean(k.gesperrt) }]);
      neueKinder++;
    }
    const p = profil(k.name);
    neueRunden += profileVereinen(p, { ...leeresProfil(), ...alt });
    profilSpeichern(k.name, p);
  }
  // Auf einem leeren (z. B. zurückgesetzten) iPad die alte iPad-Kennung und Rundenzählung übernehmen.
  if (warLeer && inhalt.geraet?.kennung) {
    geraetAendern((g) => { g.kennung = inhalt.geraet.kennung; g.runden = Math.max(g.runden || 0, inhalt.geraet.runden || 0); });
  } else if (inhalt.geraet?.kennung === geraet().kennung) {
    geraetAendern((g) => { g.runden = Math.max(g.runden || 0, inhalt.geraet.runden || 0); });
  }
  return { ok: true, neueKinder, neueRunden, alle: inhalt.kinder.length };
}
