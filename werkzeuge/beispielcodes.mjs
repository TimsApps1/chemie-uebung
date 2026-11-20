// Erzeugt tests/beispielcodes.txt: 20 Beispielcodes (auch doppelte und ungültige) für die Abnahme von Etappe 2.
// Aufruf: node werkzeuge/beispielcodes.mjs
import fs from 'node:fs/promises';
import { punktecode, namensKennung } from '../js/codes.js';
import { kurzname, datumVonTag, wocheVonTag } from '../js/hilfen.js';

const TAG = 470; // Woche vom 09.11.2026 bis 15.11.2026
const kinder = {
  'Lena Schmidt': [70, 60, 80, 50],
  'Jonas Becker': [80, 80],
  'Elif Yilmaz': [50, 60, 70],
  'Noah Klein': [40],
  'Mira Wolf': [70, 70, 60],
  'Tom Berg': [30, 30]
};
let nummer = 1;
const zeilen = [];
const code = (name, punkte, niveau = 1) => punktecode({
  name: kurzname(name), bereich: 'B3', niveau, punkte, tag: TAG, kurs: 'G', erster: punkte / 10, warum: 0,
  kennung: namensKennung(name), geraet: 'T1', nummer: nummer++
});
const gemerkt = {};
for (const [name, liste] of Object.entries(kinder)) {
  for (const p of liste) {
    const c = code(name, p);
    zeilen.push(`${name}: ${c}`);
    gemerkt[`${name}|${p}`] = c;
  }
}
zeilen.push(`Jonas Becker (★★): ${code('Jonas Becker', 70, 2)}`);
// 2 doppelte
zeilen.push(`Lena Schmidt (doppelt abgegeben): ${gemerkt['Lena Schmidt|80']}`);
zeilen.push(`Mira Wolf (doppelt abgegeben): ${gemerkt['Mira Wolf|70']}`);
// 2 ungültige
const gefaelscht = gemerkt['Noah Klein|40'].replace('-0040-', '-0080-');
zeilen.push(`Noah Klein (Punkte nachträglich geändert): ${gefaelscht}`);
zeilen.push(`Tom Berg (abgeschnitten): ${gemerkt['Tom Berg|30'].slice(0, -4)}`);

const text = `Beispielcodes für die Abnahme von Etappe 2 (Bereich B3, Woche ${datumVonTag(wocheVonTag(TAG) * 7 - 4)} bis ${datumVonTag(wocheVonTag(TAG) * 7 + 2)})
Klassenliste: ${Object.keys(kinder).join(', ')}

${zeilen.join('\n')}

Erwartetes Ergebnis nach dem Einlesen: 16 neu, 2 doppelt, 2 ungültig.
Die besten 5 in B3 ★ für diese Woche (Wochenwert = 3 beste Runden):
1. Lena S. – 210
2. Mira W. – 200
3. Elif Y. – 180
4. Jonas B. – 160
5. Tom B. – 60
(Noah K. mit 40 ist nicht dabei. Jonas' ★★-Runde zählt nur in der ★★-Liste.)
`;
await fs.writeFile(new URL('../tests/beispielcodes.txt', import.meta.url), text);
console.log(text);
