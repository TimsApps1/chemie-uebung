# Format der Aufgaben-Dateien

Die Aufgaben stehen in `daten/aufgaben/b1.json`, `b3.json` und `b4.json` (später auch `b2.json`). Jede Datei sieht so aus:

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
| `typ` | ja | `auswahl`, `zahl`, `sortieren`, `klappt`, `wortgleichung`, `antippen`, `bauen`, `modell`, `ausgleichen` (siehe unten) |
| `frage` | ja | Arbeitsanweisung, **höchstens ein Satz** |
| `symbol` | ja | Ein Zeichen vor der Frage: ✋ antippen, ↕ sortieren, 🔢 zählen, ✏️ ergänzen, ❓ auswählen |
| `denkanstoss` | ja | Hilfe nach dem 1. Fehler. Verrät die Lösung **nicht**. |
| `alltag` | nein | Ein Satz nach der richtigen Lösung, woher man den Stoff kennt, z. B. „NaCl ist Kochsalz.“ |
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

### `bauen` – Formel mit Noppen-Bausteinen bauen (Bereich 1)
```json
{ "id": "b1-2-01", "niveau": 2, "typ": "bauen", "symbol": "🧱", "kann": "bauen",
  "frage": "Baue Aluminiumoxid.", "formel": "Al2O3", "steine": ["Al", "O"], ... }
```
`steine` = die Steine in der Leiste. Bei Eisen und Kupfer mit römischer Zahl: `"Fe(II)"`, `"Fe(III)"`,
`"Cu(I)"`, `"Cu(II)"`. Optional `"start": ["Mg"]` – dieser Stein liegt schon zu Beginn da
(für „Fülle alle Noppen“). Gelöst ist die Aufgabe, wenn alle Noppen belegt sind und die Atomzahl zur
`formel` passt; die Anordnung ist egal. Die App prüft beim Start, ob sich die Formel mit diesen Steinen
bauen lässt. Keine Schwefeloxide, Stickoxide und kein Kohlenstoffmonooxid (passen nicht ins Noppenmodell).

### `modell` – Welche Formel hat dieses Modell?
Wie `auswahl`, dazu `formel` und `steine`: Die App baut das Modell selbst und zeigt es in 3D.

### `ausgleichen` – Reaktion mit der Waage ausgleichen (Bereich 2)
```json
{ "id": "b2-1-06", "niveau": 1, "typ": "ausgleichen", "symbol": "⚖", "kann": "teilchen",
  "frage": "Gleiche die Gleichung aus.",
  "edukte": [ { "formel": "Mg", "name": "Magnesium" }, { "formel": "O2", "name": "Sauerstoff" } ],
  "produkte": [ { "formel": "MgO", "name": "Magnesiumoxid" } ],
  "loesung": [2, 1, 2],
  "denkanstoss": "O2 bringt 2 O-Atome mit. Wie viele MgO brauchst du dafür?",
  "erklaerung": "2 Mg + O2 → 2 MgO: links 2 Mg und 2 O, rechts auch." }
```
- `edukte` = Stoffe vor dem Pfeil, `produkte` = Stoffe danach. Jeder Stoff braucht `formel` und `name` (bei Eisen und Kupfer mit römischer Zahl, z. B. „Eisen(III)-oxid“).
- `loesung` = die Zahlen davor, erst alle Edukte, dann alle Produkte. Die App prüft beim Start, ob sie stimmen (ausgeglichen, kleinste Zahlen).
- Die Kinder beginnen mit lauter 1. Auf ★★★ ist die Waage verdeckt, bis man auf „Wiegen“ tippt.
- **Nur prüfen:** Mit `"pruefen": true` und `"start": [1, 1, 1]` fragt die App „Ist die Gleichung ausgeglichen?“ (Ja/Nein) für genau diese Zahlen.
- **Index-Falle (optional):** Bei einem Stoff `"falle": { "formel": "H2O2", "text": "Aus H2O würde H2O2 …" }`. Ohne `falle` erklärt die App selbst, warum man die kleinen Zahlen nicht ändern darf.

### `warum` – Begründung (nur ★★★, Bereich 3)
Zusatz bei einer Aufgabe. Die App stellt die Frage nach jeder zweiten Antwort. Richtig = 5 Extrapunkte.
```json
"warum": { "frage": "Warum klappt es?",
  "antworten": ["Zink hält Sauerstoff stärker fest als Kupfer.",
                "Kupfer hält Sauerstoff stärker fest als Zink.",
                "Zink ist schwerer als Kupfer."],
  "richtig": "Zink hält Sauerstoff stärker fest als Kupfer." }
```
