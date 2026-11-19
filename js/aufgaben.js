// Darstellung und Prüfung der Aufgabentypen.
// Jede Darstellung bekommt `antworten(wert)` und liefert ein Objekt mit
//   ergebnis(wert, richtig, endgueltig)  – Markierungen setzen
//   nochmal()                            – für den zweiten Versuch freigeben
import { el, mischen, formelKnoten, buchstabieren } from './hilfen.js';
import { text, baustein } from './ui.js';
import { klapptEs, richtigeZahl } from './daten.js';
import { formelModell } from './modell3d.js';

// ---------- Prüfen ----------

export function pruefen(a, wert, daten) {
  switch (a.typ) {
    case 'auswahl':
    case 'antippen':
      return wert === a.richtig;
    case 'zahl':
      return Number(wert) === richtigeZahl(a);
    case 'sortieren':
      return wert.join('|') === a.karten.join('|');
    case 'klappt':
      return wert === klapptEs(daten.reihe, a.oxid, a.stoff);
    case 'wortgleichung': {
      const [links, rechts] = luckenAufteilen(a);
      const gleich = (x, y) => [...x].sort().join('|') === [...y].sort().join('|');
      return gleich(wert.links, links) && gleich(wert.rechts, rechts);
    }
    default:
      return false;
  }
}

// Fester Hinweis zu einer bestimmten falschen Antwort (oder automatisch erzeugt).
export function fehlerHinweis(a, wert) {
  const schluessel = Array.isArray(wert) ? wert.join(', ') : String(wert);
  if (a.fehler && a.fehler[schluessel]) return a.fehler[schluessel];
  if (a.typ === 'zahl') {
    const faktor = Number((String(a.formel).match(/^\s*(\d+)\s/) || [])[1] || 1);
    const gesamt = richtigeZahl(a);
    if (faktor > 1 && Number(wert) === gesamt / faktor) {
      return `Die große ${faktor} gilt für das ganze Teilchen: ${faktor} · ${gesamt / faktor} = ${gesamt}.`;
    }
  }
  return null;
}

export function loesungsText(a, daten) {
  switch (a.typ) {
    case 'auswahl':
    case 'antippen': return a.richtig;
    case 'zahl': return String(richtigeZahl(a));
    case 'sortieren': return a.karten.join(' · ');
    case 'klappt': return klapptEs(daten.reihe, a.oxid, a.stoff) ? 'Es klappt.' : 'Es klappt nicht.';
    case 'wortgleichung': {
      let i = 0;
      const fuellen = (s) => (s === '?' ? a.richtig[i++] : s);
      return `${a.links.map(fuellen).join(' + ')} → ${a.rechts.map(fuellen).join(' + ')}`;
    }
    default: return '';
  }
}

// Text zum Vorlesen der Aufgabe.
// reihenfolge = so, wie die Antworten auf dem Bildschirm stehen (gemischt).
export function vorleseText(a, reihenfolge = null) {
  const teile = [a.frage];
  if (a.typ === 'klappt') teile.push(`${a.oxid} und ${a.stoff}`);
  if (a.typ === 'zahl') teile.push(a.formel);
  if (a.links) teile.push(`${a.links.map((s) => (s === '?' ? 'Lücke' : s)).join(' + ')} → ${a.rechts.map((s) => (s === '?' ? 'Lücke' : s)).join(' + ')}`);
  if (a.typ === 'wortgleichung') teile.push('Zur Auswahl: ' + (reihenfolge || a.auswahl).join(', '));
  if (a.typ === 'sortieren') teile.push((reihenfolge || a.karten).map((k, i) => `Karte ${i + 1}: ${k}`).join('. '));
  if (a.gleichung) teile.push(a.gleichung);
  if (a.antworten && a.typ === 'auswahl') {
    const liste = reihenfolge || a.antworten;
    teile.push(liste.map((t, i) => `Antwort ${i + 1}: ${t.length <= 3 && !t.includes(' ') ? buchstabieren(t) : t}`).join('. '));
  }
  if (a.typ === 'klappt') teile.push('Klappt, oder klappt nicht');
  return teile.join('. ');
}

function luckenAufteilen(a) {
  let i = 0;
  const links = []; const rechts = [];
  for (const s of a.links) if (s === '?') links.push(a.richtig[i++]);
  for (const s of a.rechts) if (s === '?') rechts.push(a.richtig[i++]);
  return [links, rechts];
}

const marke = (richtig) => el('span', { class: 'marke', 'aria-label': richtig ? 'richtig' : 'falsch' }, richtig ? '✓' : '✗');

function markieren(knopf, richtig) {
  knopf.classList.remove('gewaehlt');
  knopf.classList.add(richtig ? 'ist-richtig' : 'ist-falsch');
  knopf.querySelector('.marke')?.remove();
  knopf.prepend(marke(richtig));
}

// ---------- Auswahl (auch für "Warum?") ----------

function auswahl(a, antworten) {
  const lang = a.antworten.some((t) => t.length > 18);
  const reihenfolge = mischen(a.antworten);
  const knoepfe = reihenfolge.map((t) => el('button', {
    type: 'button', class: 'knopf antwort' + (lang ? ' antwort-lang' : ''), 'data-wert': t,
    onclick: (e) => {
      knoepfe.forEach((k) => { k.disabled = true; });
      e.currentTarget.classList.add('gewaehlt');
      antworten(t);
    }
  }, el('span', {}, formelKnoten(t))));
  const wurzel = el('div', {},
    a.gleichung ? el('p', { class: 'gleichung' }, text(a.gleichung)) : null,
    el('div', { class: 'antworten' + (lang ? ' antworten-lang' : '') }, knoepfe));
  return {
    wurzel,
    reihenfolge,
    ergebnis(wert, richtig, endgueltig) {
      const gewaehlt = knoepfe.find((k) => k.dataset.wert === wert);
      if (gewaehlt) markieren(gewaehlt, richtig);
      if (!richtig && endgueltig) {
        const r = knoepfe.find((k) => k.dataset.wert === a.richtig);
        if (r) markieren(r, true);
      }
    },
    nochmal() {
      knoepfe.forEach((k) => { if (!k.classList.contains('ist-falsch')) k.disabled = false; });
    }
  };
}

// ---------- Zahl (Atome zählen) ----------

function zahl(a, antworten) {
  let eingabe = '';
  const anzeige = el('output', { class: 'zahl-anzeige', 'aria-live': 'polite' }, '?');
  const pruefKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt zahl-pruefen', disabled: true, onclick: () => {
    sperren(true);
    antworten(Number(eingabe));
  } }, 'Prüfen');
  const tasten = [];
  const setzen = (neu) => {
    eingabe = neu.slice(0, 2);
    anzeige.textContent = eingabe || '?';
    pruefKnopf.disabled = !eingabe;
  };
  for (const z of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0']) {
    tasten.push(el('button', {
      type: 'button', class: 'knopf taste' + (z === '⌫' ? ' taste-loeschen' : ''),
      'aria-label': z === '⌫' ? 'Löschen' : z,
      onclick: () => setzen(z === '⌫' ? eingabe.slice(0, -1) : eingabe + z)
    }, z));
  }
  const sperren = (ja) => { tasten.forEach((t) => { t.disabled = ja; }); pruefKnopf.disabled = ja || !eingabe; };
  const modell = el('div', { class: 'modell3d' });
  const wurzel = el('div', { class: 'zahl-aufgabe' },
    el('p', { class: 'formel-gross' }, formelKnoten(a.formel)),
    modell,
    el('p', { class: 'tipp mitte' }, '↻ Mit einem Finger drehen'),
    el('div', { class: 'zahl-eingabe' }, anzeige, el('div', { class: 'tastenfeld' }, tasten, pruefKnopf)));
  requestAnimationFrame(() => {
    try { formelModell(modell, a.formel); } catch { modell.remove(); }
  });
  return {
    wurzel,
    ergebnis(wert, richtig, endgueltig) {
      anzeige.classList.add(richtig ? 'ist-richtig' : 'ist-falsch');
      anzeige.replaceChildren(marke(richtig), String(wert));
      if (!richtig && endgueltig) anzeige.after(el('span', { class: 'zahl-loesung' }, marke(true), String(richtigeZahl(a))));
    },
    nochmal() {
      anzeige.classList.remove('ist-richtig', 'ist-falsch');
      setzen('');
      sperren(false);
    }
  };
}

// ---------- Sortieren (Ziehen ODER zwei Karten antippen) ----------

function sortieren(a, antworten, daten) {
  const info = Object.fromEntries(daten.reihe.stoffe.map((s) => [s.name, s]));
  let reihenfolge = mischen(a.karten);
  while (reihenfolge.join('|') === a.karten.join('|') && a.karten.length > 1) reihenfolge = mischen(a.karten);

  const liste = el('ol', { class: 'sortierliste', 'aria-label': 'Karten zum Sortieren' });
  let gewaehlt = null;
  let gesperrt = false;

  const karte = (name) => {
    const s = info[name] || { name, symbol: '' };
    const k = el('li', { class: 'sortierkarte', 'data-name': name, tabindex: '0', role: 'button', 'aria-pressed': 'false',
      'aria-label': `${name}. Antippen, dann eine zweite Karte antippen zum Tauschen.` },
    el('span', { class: 'griff', 'aria-hidden': 'true' }, '⠿'),
    s.symbol ? baustein(s.symbol, { metall: s.name !== 'Kohlenstoff', klein: true }) : null,
    el('span', { class: 'sortierkarte-text' },
      el('b', {}, name),
      s.hinweis ? el('small', {}, s.hinweis) : null));
    ziehenEinrichten(k);
    return k;
  };

  const zeichnen = () => {
    liste.replaceChildren(...reihenfolge.map(karte));
  };

  const antippen = (k) => {
    if (gesperrt) return;
    if (!gewaehlt) { gewaehlt = k; k.classList.add('gewaehlt'); k.setAttribute('aria-pressed', 'true'); return; }
    if (gewaehlt === k) { k.classList.remove('gewaehlt'); k.setAttribute('aria-pressed', 'false'); gewaehlt = null; return; }
    const i = reihenfolge.indexOf(gewaehlt.dataset.name);
    const j = reihenfolge.indexOf(k.dataset.name);
    [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
    gewaehlt = null;
    const name = k.dataset.name;
    zeichnen();
    liste.querySelector(`[data-name="${name}"]`)?.focus({ preventScroll: true });
  };

  function ziehenEinrichten(k) {
    let start = null;
    let gezogen = false;
    let perZeiger = false;
    // Hilfsmittel (Schaltersteuerung, Sprachsteuerung) lösen oft nur "click" aus.
    k.addEventListener('click', () => { if (perZeiger) { perZeiger = false; return; } antippen(k); });
    k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); antippen(k); } });
    k.addEventListener('pointerdown', (e) => {
      if (gesperrt) return;
      start = { y: e.clientY, id: e.pointerId };
      gezogen = false;
      k.setPointerCapture?.(e.pointerId);
    });
    k.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      if (!gezogen && Math.abs(dy) < 10) return;
      if (!gezogen) {
        gezogen = true;
        k.classList.add('zieht');
        if (gewaehlt) { gewaehlt.classList.remove('gewaehlt'); gewaehlt = null; }
      }
      k.style.transform = `translateY(${dy}px)`;
      // Mit Nachbarn tauschen, sobald die Mitte überschritten ist.
      const karten = [...liste.children];
      const i = karten.indexOf(k);
      const r = k.getBoundingClientRect();
      const mitte = r.top + r.height / 2;
      const nach = karten[i + 1];
      const vor = karten[i - 1];
      if (nach && mitte > nach.getBoundingClientRect().top + nach.offsetHeight / 2) {
        const h = nach.offsetHeight + 8;
        liste.insertBefore(nach, k);
        start.y += h;
        k.style.transform = `translateY(${e.clientY - start.y}px)`;
      } else if (vor && mitte < vor.getBoundingClientRect().top + vor.offsetHeight / 2) {
        const h = vor.offsetHeight + 8;
        liste.insertBefore(k, vor);
        start.y -= h;
        k.style.transform = `translateY(${e.clientY - start.y}px)`;
      }
    });
    const ende = (e) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      k.style.transform = '';
      k.classList.remove('zieht');
      if (gezogen) reihenfolge = [...liste.children].map((x) => x.dataset.name);
      else if (e.type === 'pointerup') { perZeiger = true; antippen(k); }
    };
    k.addEventListener('pointerup', ende);
    k.addEventListener('pointercancel', ende);
  }

  zeichnen();
  const pruefKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', onclick: () => {
    gesperrt = true;
    pruefKnopf.disabled = true;
    if (gewaehlt) { gewaehlt.classList.remove('gewaehlt'); gewaehlt = null; }
    antworten([...reihenfolge]);
  } }, 'Fertig – prüfen');
  const wurzel = el('div', { class: 'sortieren' },
    el('p', { class: 'sortier-rand' }, el('b', {}, 'edel'), ' – ', daten.reihe.oben),
    liste,
    el('p', { class: 'sortier-rand' }, el('b', {}, 'unedel'), ' – ', daten.reihe.unten),
    el('p', { class: 'tipp' }, 'Ziehen oder zwei Karten nacheinander antippen, dann tauschen sie.'),
    pruefKnopf);
  return {
    wurzel,
    reihenfolge: () => [...reihenfolge],
    ergebnis(wert, richtig, endgueltig) {
      if (!richtig && !endgueltig) return;
      if (!richtig) { reihenfolge = [...a.karten]; zeichnen(); }
      [...liste.children].forEach((k) => { k.classList.add('ist-richtig'); k.prepend(marke(true)); });
    },
    nochmal() { gesperrt = false; pruefKnopf.disabled = false; }
  };
}

// ---------- Klappt es? ----------

function reiheMitMarken(daten, namen) {
  return el('div', { class: 'reihe-mini-box' },
    el('span', { class: 'reihe-ende' }, 'edel'),
    el('ol', { class: 'reihe-mini', 'aria-label': 'Reaktivitätsreihe von edel nach unedel' },
      daten.reihe.stoffe.map((s) => el('li', { class: namen.includes(s.name) ? 'markiert' : '' },
        baustein(s.symbol, { metall: s.name !== 'Kohlenstoff', klein: true }),
        el('span', {}, s.name, namen.includes(s.name) ? el('span', { class: 'nur-vorlesen' }, ' (markiert)') : null)))),
    el('span', { class: 'reihe-ende' }, 'unedel'));
}

function klappt(a, antworten, daten) {
  const knoepfe = [
    el('button', { type: 'button', class: 'knopf antwort antwort-lang', 'data-wert': 'ja',
      onclick: () => waehlen(true) }, el('span', {}, '🔥 Klappt')),
    el('button', { type: 'button', class: 'knopf antwort antwort-lang', 'data-wert': 'nein',
      onclick: () => waehlen(false) }, el('span', {}, 'Klappt nicht'))
  ];
  const reiheBox = el('div', { class: 'reihe-box', hidden: true });
  function waehlen(ja) {
    knoepfe.forEach((k) => { k.disabled = true; });
    knoepfe[ja ? 0 : 1].classList.add('gewaehlt');
    antworten(ja);
  }
  const oxidElement = daten.reihe.stoffe.find((s) => s.oxid === a.oxid)?.name;
  const wurzel = el('div', {},
    el('p', { class: 'gleichung gleichung-gross' }, text(a.oxid), el('span', { class: 'plus' }, ' + '), text(a.stoff), el('span', { class: 'pfeil' }, ' → ?')),
    el('div', { class: 'antworten' }, knoepfe),
    reiheBox);
  return {
    wurzel,
    ergebnis(wert, richtig, endgueltig) {
      markieren(knoepfe[wert ? 0 : 1], richtig);
      if (!richtig && endgueltig) markieren(knoepfe[wert ? 1 : 0], true);
      if (richtig || endgueltig) {
        reiheBox.hidden = false;
        reiheBox.replaceChildren(el('p', { class: 'tipp' }, `So stehen ${oxidElement} und ${a.stoff} in der Reihe:`),
          reiheMitMarken(daten, [oxidElement, a.stoff]));
      }
    },
    nochmal() { knoepfe.forEach((k) => { if (!k.classList.contains('ist-falsch')) k.disabled = false; }); }
  };
}

// ---------- Wortgleichung ergänzen ----------

function wortgleichung(a, antworten) {
  const luecken = [];
  const beschriften = (l, zustand) => l.setAttribute('aria-label',
    zustand === 'leer' ? 'Lücke, leer' : zustand === 'geloest' ? `Lücke, Lösung: ${l.dataset.wert}` : `Lücke: ${l.dataset.wert}. Antippen zum Leeren.`);
  const seite = (stoffe, wo) => stoffe.flatMap((s, i) => {
    const teil = s === '?'
      ? (() => {
        const l = el('button', { type: 'button', class: 'luecke', 'data-seite': wo, 'aria-label': 'Lücke',
          onclick: () => { if (!gesperrt && l.dataset.wert) { l.dataset.wert = ''; l.replaceChildren('___'); beschriften(l, 'leer'); aktualisieren(); } } }, '___');
        luecken.push(l);
        return l;
      })()
      : el('span', { class: 'stoff' }, text(s));
    return i < stoffe.length - 1 ? [teil, el('span', { class: 'plus' }, ' + ')] : [teil];
  });
  let gesperrt = false;
  const chipFolge = mischen(a.auswahl);
  const chips = chipFolge.map((s) => el('button', { type: 'button', class: 'knopf chip',
    onclick: () => {
      if (gesperrt) return;
      const frei = luecken.find((l) => !l.dataset.wert);
      if (!frei) return;
      frei.dataset.wert = s;
      frei.replaceChildren(formelKnoten(s));
      beschriften(frei, 'gefuellt');
      aktualisieren();
    } }, formelKnoten(s)));
  const pruefKnopf = el('button', { type: 'button', class: 'knopf knopf-haupt knopf-breit', disabled: true, onclick: () => {
    gesperrt = true;
    pruefKnopf.disabled = true;
    antworten({
      links: luecken.filter((l) => l.dataset.seite === 'l').map((l) => l.dataset.wert),
      rechts: luecken.filter((l) => l.dataset.seite === 'r').map((l) => l.dataset.wert)
    });
  } }, 'Prüfen');
  function aktualisieren() { pruefKnopf.disabled = gesperrt || luecken.some((l) => !l.dataset.wert); }
  const wurzel = el('div', {},
    el('p', { class: 'gleichung gleichung-gross' }, seite(a.links, 'l'), el('span', { class: 'pfeil' }, ' → '), seite(a.rechts, 'r')),
    el('p', { class: 'tipp' }, 'Tippe einen Stoff an. Er kommt in die nächste Lücke. Lücke antippen = leeren.'),
    el('div', { class: 'chips' }, chips),
    pruefKnopf);
  return {
    wurzel,
    ergebnis(wert, richtig, endgueltig) {
      if (richtig) { luecken.forEach((l) => { l.classList.add('ist-richtig'); l.prepend(marke(true)); beschriften(l, 'geloest'); }); return; }
      if (endgueltig) {
        let i = 0;
        luecken.forEach((l) => {
          l.dataset.wert = a.richtig[i++];
          l.replaceChildren(marke(true), formelKnoten(l.dataset.wert));
          l.classList.add('ist-richtig');
          beschriften(l, 'geloest');
        });
      }
    },
    reihenfolge: chipFolge,
    nochmal() {
      gesperrt = false;
      luecken.forEach((l) => { l.dataset.wert = ''; l.replaceChildren('___'); beschriften(l, 'leer'); });
      aktualisieren();
    }
  };
}

// ---------- Stoff in der Gleichung antippen ----------

function antippen(a, antworten) {
  const knoepfe = [];
  const stoff = (s) => {
    const k = el('button', { type: 'button', class: 'knopf stoff-knopf', 'data-wert': s,
      onclick: () => { knoepfe.forEach((x) => { x.disabled = true; }); k.classList.add('gewaehlt'); antworten(s); } },
    el('span', {}, formelKnoten(s)));
    knoepfe.push(k);
    return k;
  };
  const seite = (stoffe) => stoffe.flatMap((s, i) => (i < stoffe.length - 1 ? [stoff(s), el('span', { class: 'plus' }, '+')] : [stoff(s)]));
  const wurzel = el('div', { class: 'gleichung-tippen' }, seite(a.links), el('span', { class: 'pfeil' }, '→'), seite(a.rechts));
  return {
    wurzel,
    ergebnis(wert, richtig, endgueltig) {
      markieren(knoepfe.find((k) => k.dataset.wert === wert), richtig);
      if (!richtig && endgueltig) markieren(knoepfe.find((k) => k.dataset.wert === a.richtig), true);
    },
    nochmal() { knoepfe.forEach((k) => { if (!k.classList.contains('ist-falsch')) k.disabled = false; }); }
  };
}

const DARSTELLUNG = { auswahl, zahl, sortieren, klappt, wortgleichung, antippen };

export function aufgabeDarstellen(a, antworten, daten) {
  return DARSTELLUNG[a.typ](a, antworten, daten);
}
