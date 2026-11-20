# Anleitung für die Lehrkraft

Die App läuft unter **https://timsapps1.github.io/chemie-uebung/**.
Alles, was die Kinder üben, bleibt auf dem jeweiligen iPad. Es gibt keinen Server und keine Konten.

---

## 1. App auf den iPads einrichten

1. Den Link in **Safari** öffnen.
2. Oben auf **Teilen ⬆** tippen und **„Zum Home-Bildschirm“** wählen.
3. Ab jetzt **immer über das Bausteine-Symbol** öffnen.
   Wichtig: Safari-Fenster und Home-Bildschirm-App speichern getrennt. Im Safari-Fenster kann Safari Daten
   nach einiger Zeit löschen, in der Home-Bildschirm-App nicht.
4. Die App läuft danach auch **ohne Internet**.

Gibt es eine neue Version, erscheint unten **„Neue Version – tippen zum Laden“**.

---

## 2. Lehrer-Ansicht

Auf „Wer übt?“ unten **„🔑 Lehrkraft“** antippen und die PIN eingeben.
Die Ansicht sperrt sich wieder, sobald du sie verlässt, das iPad weglegst oder 5 Minuten nichts tippst.

| Reiter | Wozu |
|---|---|
| 📥 Ergebnisse | QR-Codes der Kinder scannen oder Text aus Classroom einfügen |
| 📊 Übersicht | Alle Kinder mit Bestwert, Durchschnitt und „beim 1. Versuch richtig“; Tabellen für Numbers/Excel |
| 🏆 Beamer | Die besten 5, Am meisten verbessert, Teams und Klassenziel |
| 👥 Klasse | Klassenliste (Vor- und Nachname, optional G/E) |
| 💾 Sicherung | Ergebnisse als Datei sichern und wiederherstellen |
| 🔑 Codes | Freischaltcodes für Bereiche (getrennt nach G- und E-Kurs) |
| 📱 Dieses iPad | Namen auf diesem iPad umbenennen, zusammenführen, sperren, löschen |
| ⚙ Einstellungen | Zeitbalken bei ★★★, PIN ändern |

### PIN ändern
Im Reiter ⚙ eine neue PIN (6–8 Ziffern) eingeben und auf **„Zeile erzeugen“** tippen.
Dann auf github.com die Datei **daten/app.json** öffnen, auf den Stift tippen und die Zeile mit
`admin_pin_pruefsumme` ersetzen. Auf **„Commit changes“** tippen.
Die neue PIN gilt, sobald die iPads die App mit Internet öffnen.

**Ehrlich zur Sicherheit:** PIN und Codes sind nur ein Sichtschutz. Der Quelltext ist öffentlich.

---

## 3. Bereiche freischalten

Im Reiter 🔑 stehen die Codes. Verteile sie in Google Classroom.

- Bereich 3 und 4 haben je einen **G-Code** und einen **E-Code**.
  Der E-Code schaltet zusätzlich die E-Aufgaben frei (z. B. Reduktionsmittel/Oxidationsmittel).
- Bereich 1 und 2 gibt es nur für den E-Kurs.
- Die Freischaltung gilt pro Name. Kinder im G-Kurs sehen die E-Bereiche gar nicht.

**Neue Codes** (z. B. neues Schuljahr): im Reiter 🔑 „Neue Codes erzeugen“. Alte Codes funktionieren weiter,
bis du in **daten/app.json** den Wert `codes_ab_serie` auf die neue Seriennummer setzt.

---

## 4. Namen der Kinder

Die Kinder geben **Vor- und Nachnamen** ein, genau wie auf der Klassenliste.
Daraus entsteht ein Kurzname (höchstens 8 Zeichen), z. B. *Mohammed Yilmaz* → **MOHAMYIL**.
Dazu kommt eine Kennung aus dem vollen Namen, damit z. B. *Lena Schmidt* und *Lena Schneider*
(beide **LENASCH**) unterscheidbar bleiben.

Trage im Reiter 👥 deine **Klassenliste** ein (ein Kind pro Zeile, z. B. `Lena Schmidt; G`).
Dann zeigt die App überall die vollen Namen. Hat ein Kind seinen Namen anders getippt, erscheint es im
Reiter 📥 unter **„Nicht zugeordnet“** – ein Tipp genügt zum Zuordnen.

---

## 5. Ergebnisse einsammeln

Nach jeder Runde bekommt das Kind einen **Punktecode**, z. B.
`LENASCH-B3-2-0070-0470-G70-6W-P7-012-K9Q`
(Name · Bereich · Niveau · Punkte · Tag · Kurs + Aufgaben beim 1. Versuch richtig + Begründungen ·
Namens-Kennung · iPad · Runde · Prüfsumme). Die Prüfsumme erkennt Tippfehler und einfache Fälschungen.

**In der Stunde (am schnellsten):**
1. Das Kind tippt auf **„📷 Ergebnisse zeigen“** (Startseite oder Mein Fortschritt).
2. Du öffnest Lehrkraft → 📥 → **„📷 QR-Codes scannen“** und hältst die Kamera davor.
   Hat das Kind viele Runden, zeigt es mehrere QR-Codes nacheinander („Nächster ▶“).
3. Beim ersten Mal fragt das iPad, ob die App die Kamera benutzen darf → **Erlauben**.

**Von zu Hause (Classroom):**
1. Das Kind tippt in „Mein Fortschritt“ → „Codes für die Lehrkraft“ auf **„📋 Alle Codes kopieren“**
   und fügt sie als privaten Kommentar in Classroom ein.
2. Du kopierst die Kommentare (oder die ganze Seite) und fügst sie in Lehrkraft → 📥 ein.
   Die App findet alle Codes selbst.

Doppelte Codes werden automatisch ignoriert. Ungültige Codes werden mit Grund angezeigt.
Es werden immer die Runden der letzten 6 Wochen abgegeben, du kannst also ruhig mehrmals einsammeln.

---

## 6. Übersicht, Tabelle und Beamer

- **📊 Übersicht:** pro Kind und Niveau Bestwert, Durchschnitt, Anteil „beim 1. Versuch richtig“ und Zahl
  der Runden. Antippen eines Namens zeigt alle Runden und die Punkte pro Woche.
- **Tabelle speichern:** „📄 Alle Runden“ oder „📄 Übersicht pro Kind“. Auf dem iPad öffnet sich das
  Teilen-Menü → „In Dateien sichern“ oder per Mail. Die Datei öffnet sich in Numbers oder Excel.
- **🏆 Beamer:** Bereich, Niveau und Woche wählen, dann „🖥 Beamer-Ansicht öffnen“.
  Wochenwert = Summe der 3 besten Runden der Woche. Gezeigt werden nur die besten 5.
- **Bereich 2 (Reaktionen ausgleichen, nur E-Kurs)**: Die Kinder nehmen mit + und – ganze Teilchen dazu oder weg.
  Eine Waage zählt jedes Element links und rechts. Stimmt alles, erscheint die Gleichung. Auf ★★★ ist die Waage
  verdeckt, bis das Kind auf „Wiegen“ tippt – das zählt als Versuch. Der Knopf „Atom anhängen“ zeigt,
  warum man die kleinen Zahlen nicht ändern darf (z. B. H₂O → H₂O₂), und nimmt die Änderung gleich zurück.
  Für Noten: Auf ★ und ★★ hilft die Waage beim Probieren mit. Was ein Kind ohne Hilfe kann, zeigt ★★★.
- **Bereich 1 (Formeln bauen, nur E-Kurs)** erscheint in Übersicht, Tabelle und Beamer wie die anderen Bereiche.
  Beim Bauen wird automatisch geprüft, sobald alle Noppen belegt sind. „Beim 1. Versuch richtig“ heißt dort:
  Das erste fertig gebaute Modell war richtig.

---

### Am meisten verbessert, Teams, Klassenziel (Reiter 🏆 Beamer, „Was zeigen?“)
- **📈 Am meisten verbessert:** Bestwert dieser Woche gegen den eigenen Bestwert der 6 Wochen davor
  (gleicher Bereich und gleiches Niveau). Es zählen nur Kinder mit mindestens 2 Runden in dieser Woche.
  Höchstens 5 Namen.
- **👥 Teams:** Unter „Teams anlegen“ ein Team pro Zeile eintragen, z. B. `Team Rot: Lena Schmidt, Jonas Becker`.
  „🔀 Gemischte Teams vorschlagen“ verteilt starke und schwächere Kinder gleichmäßig.
  Teamwert = **Durchschnitt** der Mitglieder (pro Kind die 3 besten Runden der Woche), nicht die Summe.
- **🎯 Klassenziel:** Alle Punkte der Klasse in dieser Woche zusammen als Balken. Das Ziel stellst du dort ein
  (Vorschlag: 150 Punkte pro Kind und Woche).

### Für die Kinder
- **⚔ Duell zu zweit** (auf „Wer übt?“): Zwei Kinder spielen abwechselnd am selben iPad, jedes auf seinem Niveau
  (★ = 1, ★★ = 2, ★★★ = 3 Punkte pro richtiger Antwort). Wer zuerst 10 Punkte hat, ist zuerst am Ziel.
  Am Ende steht „Gut gespielt, beide!“. Duelle erzeugen keinen Punktecode und werden nicht gespeichert.
- **Abzeichen** (in „Mein Fortschritt“): nur für Fleiß und Verbesserung – 10 und 25 Runden geübt, 5 und 20 Fehler
  ausgebessert, 3-mal den eigenen Rekord verbessert, 3 Wochenziele geschafft.
- **Meine Fehler:** Falsche Aufgaben kommen nach 1 Tag, 3 Tagen und 1 Woche wieder (Knopf „Heute üben“).

## 7. Sicherung – bitte regelmäßig!

Alle eingesammelten Ergebnisse liegen **nur auf deinem iPad**.
Lehrkraft → 💾 → **„Sicherung speichern“** → im Teilen-Menü „In Dateien sichern“ (iCloud) oder per Mail.
Die App erinnert dich, wenn die letzte Sicherung länger als 7 Tage her ist.
Mit **„Sicherung laden“** kommt alles zurück (auch auf einem neuen iPad). Vorhandene Daten bleiben erhalten.

---

## 8. Aufgaben ändern oder neue eintragen (auf github.com)

Die Aufgaben stehen in **daten/aufgaben/b1.json**, **b2.json**, **b3.json** und **b4.json**.
Das Format ist in **daten/FORMAT.md** genau beschrieben.

1. Auf github.com die Datei öffnen und auf den **Stift** (Bearbeiten) tippen.
2. Eine vorhandene Aufgabe kopieren, einfügen und ändern. Jede Aufgabe braucht eine neue, eindeutige `id`.
3. Auf **„Commit changes“** tippen.
4. Die iPads holen die neuen Aufgaben beim nächsten Start mit Internet.

Ist eine Datei fehlerhaft (z. B. ein Komma fehlt), zeigt die App einen gelben Hinweis
**„Hinweis für die Lehrkraft“** mit Dateiname und Zeile. Die fehlerhafte Aufgabe wird übersprungen,
alles andere läuft weiter.

Weitere Dateien in `daten/`: Fachwörter (`fachwoerter.json`), Bereiche, Geschichten und Ich-kann-Sätze
(`bereiche.json`), Reaktivitätsreihe (`reihe.json`), Elemente (`elemente.json`), Lob-Sätze (`app.json`).
Zusätzlich erzeugt die App selbst passende Aufgaben aus der Reihe und der Elementliste
(abschaltbar mit `"aufgaben_erzeugen": false` in `app.json`).

---

## 9. App neu veröffentlichen

Änderungen an den Dateien unter `daten/` sind nach dem Speichern auf github.com sofort veröffentlicht.
Die Seite wird über **GitHub Pages** aus dem Zweig **main** gebaut (Settings → Pages).
Nach 1–2 Minuten ist die neue Fassung online.

---

## 10. Beispielcodes zum Ausprobieren

In **tests/beispielcodes.txt** stehen 20 Beispielcodes (mit doppelten und ungültigen) samt dem erwarteten
Ergebnis. Zum Ausprobieren: Klassenliste mit den dort genannten Namen anlegen, den Text in Lehrkraft → 📥
einfügen, im Beamer die Woche 09.11.–15.11.2026, Bereich B3, ★ wählen.
Danach im Reiter 💾 „Alles löschen“, damit die Beispiele nicht in deinen echten Daten bleiben.
