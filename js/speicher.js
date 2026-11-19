// Speichern nur auf diesem iPad (im Browser). Nichts geht ins Internet.
const PRAEFIX = 'chemie:';

export function lesen(schluessel, ersatz = null) {
  try {
    const roh = localStorage.getItem(PRAEFIX + schluessel);
    return roh === null ? ersatz : JSON.parse(roh);
  } catch {
    return ersatz;
  }
}

export function schreiben(schluessel, wert) {
  try {
    localStorage.setItem(PRAEFIX + schluessel, JSON.stringify(wert));
    return true;
  } catch {
    return false;
  }
}

// Bittet Safari, die Daten nicht von selbst zu löschen.
// Ergebnis: true = dauerhaft, false = nicht zugesagt, null = Gerät kann das nicht.
export async function dauerhaftBitten() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
