// Kinder auf diesem iPad, ihre Freischaltungen, Runden und Fortschritt.
// Alles bleibt auf diesem iPad.
import { lesen, schreiben, entfernen } from './speicher.js';
import { tagNummer, wocheVonTag } from './hilfen.js';

export const LIEBLINGSELEMENTE = ['H', 'O', 'C', 'N', 'Cl', 'S', 'Na', 'Mg', 'Al', 'Zn', 'Cu', 'Fe'];
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
    niveauVorschlagAbgelehnt: {}
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
  return { ton: false, zeitlimitAus: false, serie: 1, ...(lesen('geraet', {}) || {}) };
}
export function geraetAendern(fn) {
  const g = geraet();
  fn(g);
  schreiben('geraet', g);
  return g;
}
