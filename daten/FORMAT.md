# Format der Aufgaben-Dateien

Die Aufgaben stehen in `daten/aufgaben/b3.json` und `daten/aufgaben/b4.json`
(später auch `b1.json`, `b2.json`). Jede Datei sieht so aus:

```json
{
  "bereich": "B4",
  "aufgaben": [
    { ...Aufgabe... },
    { ...Aufgabe... }
  ]
}
```

## Felder, die jede Aufgabe hat

| Feld | Pflicht? | Bedeutung |
|---|---|---|
| `id` | ja | Eindeutiger Name, z. B. `"b4-1-03"` (Bereich, Niveau, Nummer). Nie doppelt. |
| `niveau` | ja | `1`, `2` oder `3` (= ★, ★★, ★★★) |
| `typ` | ja | `auswahl`, `zahl`, `sortieren`, `klappt`, `wortgleichung`, `antippen` (siehe unten) |
| `frage` | ja | Arbeitsanweisung, **höchstens ein Satz** |
| `symbol` | ja | Ein Zeichen vor der Frage: ✋ antippen, ↕ sortieren, 🔢 zählen, ✏️ ergänzen, ❓ auswählen |
| `denkanstoss` | ja | Hilfe nach dem 1. Fehler. Verrät die Lösung **nicht**. |
| `erklaerung` | ja | Ein Satz, der die Lösung erklärt (nach dem 2. Fehler und bei „Erklär’s mir“) |
| `kurs` | nein | `"E"` = nur E-Kurs. Fehlt das Feld, gilt die Aufgabe für beide Kurse. |
| `leicht` | nein | `true` = gut als Einstieg (die ersten zwei Aufgaben einer Runde sind leichter) |
| `kann` | nein | Kennung eines Ich-kann-Satzes aus `bereiche.json`, z. B. `"symbole"` |
| `bild` | nein | Dateiname eines Bildes in `bilder/`, z. B. `"kupfer.jpg"` |
| `fehler` | nein | Feste Hinweise für bestimmte falsche Antworten: `{ "falsche Antwort": "Hinweis" }` |
| `warum` | nein | Nur ★★★ in Bereich 3: Begründungsfrage, siehe unten |
| `hilfe_vorher` | nein | `false` = „Erklär’s mir“ zeigt vor der Antwort keine Regel (wenn die Regel die Antwort verraten würde) |

**Formeln** schreibt man mit normalen Ziffern: `H2O`, `Al2O3`, `2 H2O`. Die App macht daraus
automatisch H₂O, Al₂O₃, 2 H₂O. **Fachwörter** aus `fachwoerter.json` werden automatisch
unterstrichen.

## Die Aufgabentypen

### `auswahl` – eine richtige Antwort antippen
```json
{ "id": "b4-1-01", "niveau": 1, "typ": "auswahl", "symbol": "❓",
  "frage": "Welches Symbol hat Natrium?",
  "antworten": ["Na", "NA", "N", "So"], "richtig": "Na",
  "denkanstoss": "Der erste Buchstabe ist groß, der zweite klein.",
  "erklaerung": "Natrium hat das Symbol Na: großes N, kleines a." }
```
`richtig` muss genau so in `antworten` stehen. Die Reihenfolge mischt die App.
Optional `gleichung`: eine Wortgleichung, die über den Antworten steht.

### `zahl` – Atome zählen
```json
{ "id": "b4-1-05", "niveau": 1, "typ": "zahl", "symbol": "🔢",
  "frage": "Wie viele Atome sind es insgesamt?", "formel": "H2O", "zaehle": "alle",
  "denkanstoss": "Die kleine Zahl gehört zum Buchstaben davor.",
  "erklaerung": "H2O: 2 H-Atome und 1 O-Atom, zusammen 3." }
```
`zaehle` ist `"alle"` oder ein Elementsymbol wie `"O"`. **Die richtige Zahl rechnet die App
selbst aus.** Die Formel erscheint auch als 3D-Modell.

### `sortieren` – Karten in die richtige Reihenfolge bringen
```json
{ "id": "b3-1-01", "niveau": 1, "typ": "sortieren", "symbol": "↕",
  "frage": "Sortiere von edel (oben) nach unedel (unten).",
  "karten": ["Gold", "Kupfer", "Eisen", "Magnesium"], ... }
```
`karten` stehen in der **richtigen** Reihenfolge (Namen aus `reihe.json`). Die App mischt sie.

### `klappt` – Klappt die Reaktion beim Erhitzen?
```json
{ "id": "b3-1-04", "niveau": 1, "typ": "klappt", "symbol": "🔥",
  "frage": "Klappt es beim Erhitzen?", "oxid": "Kupferoxid", "stoff": "Magnesium", ... }
```
**Ob es klappt, rechnet die App aus der Reihe aus.** Verboten: Gold-/Silberoxid,
Zinkoxid + Kohlenstoff, Aluminiumoxid + Magnesium.

### `wortgleichung` – Lücken füllen
```json
{ "id": "b3-2-01", "niveau": 2, "typ": "wortgleichung", "symbol": "✏️",
  "frage": "Ergänze die Wortgleichung.",
  "links": ["Kupferoxid", "Zink"], "rechts": ["?", "?"],
  "richtig": ["Kupfer", "Zinkoxid"],
  "auswahl": ["Kupfer", "Zinkoxid", "Zink", "Kupferoxid", "Sauerstoff"], ... }
```
`?` markiert eine Lücke. `richtig` nennt die Stoffe für die Lücken (Reihenfolge egal).

### `antippen` – einen Stoff in der Gleichung antippen
```json
{ "id": "b3-2-05", "niveau": 2, "typ": "antippen", "symbol": "✋",
  "frage": "Welcher Stoff wird reduziert?",
  "links": ["Kupferoxid", "Zink"], "rechts": ["Kupfer", "Zinkoxid"], "richtig": "Kupferoxid",
  "fehler": { "Kupfer": "Kupfer hat keinen Sauerstoff. Wer gibt Sauerstoff ab?" }, ... }
```

### `warum` – Begründung (nur ★★★, Bereich 3)
Zusatz bei einer Aufgabe. Die App stellt die Frage nach jeder zweiten Antwort. Richtig = 5 Extrapunkte.
```json
"warum": { "frage": "Warum klappt es?",
  "antworten": ["Zink hält Sauerstoff stärker fest als Kupfer.",
                "Kupfer hält Sauerstoff stärker fest als Zink.",
                "Zink ist schwerer als Kupfer."],
  "richtig": "Zink hält Sauerstoff stärker fest als Kupfer." }
```
