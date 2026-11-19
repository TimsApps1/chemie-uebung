# Chemie üben

Übungs-App für Chemie, Klasse 9 (G- und E-Kurs). Läuft offline im Browser auf dem iPad,
ohne Server, ohne Konten. Alle Daten bleiben auf dem Gerät.

Die Anleitung für die Lehrkraft steht später in `ANLEITUNG.md`.

## Ordner

| Ordner/Datei | Inhalt |
|---|---|
| `index.html` | Startseite |
| `manifest.json`, `sw.js` | Home-Bildschirm und Offline-Speicher. **Bei jeder Änderung `VERSION` in `sw.js` und `js/version.js` erhöhen.** |
| `js/` | Programmcode (ES-Module, kein Build-Schritt) |
| `css/` | Aussehen |
| `lib/` | three.js 0.183.2 (`three.core.min.js`, `three.module.min.js`) und `OrbitControls.js` (Import auf `./three.module.min.js` umgestellt) |
| `daten/` | Inhalte, die die Lehrkraft auf github.com ändert |
| `bilder/` | App-Symbole und Fotos |
| `tests/` | Automatische Tests (Playwright) |
| `werkzeuge/` | Hilfsskripte für Entwickler (z. B. App-Symbole erzeugen) |

## Tests

```
node --test --test-reporter=spec tests/*.test.mjs
```

Lokal ansehen: `node tests/server.mjs 8080`, dann `http://127.0.0.1:8080/chemie-uebung/` öffnen.
