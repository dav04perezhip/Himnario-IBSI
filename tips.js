// Consejos de armonía ("modo Consejos") del Himnario IBSI.
//
// Mira la sucesión de acordes de la alabanza en el tono que se está mostrando y, para cada
// acorde, sugiere qué se podría tocar antes, en lugar de él o encima de él:
// cadencia plagal, dominantes secundarias, disminuidos de paso, slides cromáticos,
// suspensiones, bajos que caminan y escalas para el solista.
// Todo se calcula con los grados del tono, así que funciona en cualquier transposición.

(function () {
  const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const INDEX = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

  // Grados de la escala mayor: semitonos desde la tónica → nombre del grado.
  const DEGREE_NAMES = { 0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°" };

  function parseChord(name) {
    const match = /^\(?([A-G])([#b]?)([^/)]*)(?:\/([A-G][#b]?))?\)?$/.exec(String(name || "").trim());
    if (!match) return null;
    const root = INDEX[match[1] + match[2]];
    if (root === undefined) return null;
    const suffix = match[3] || "";
    return {
      name,
      root,
      minor: /^m(?!aj)/.test(suffix),
      dim: /dim|°|º/.test(suffix),
      seventh: /7/.test(suffix),
      sus: /sus/.test(suffix),
      bass: match[4] ? INDEX[match[4]] : null
    };
  }

  function makeNamer(preferFlats) {
    const names = preferFlats ? FLATS : SHARPS;
    return (index, suffix = "") => `${names[((index % 12) + 12) % 12]}${suffix}`;
  }

  // Tónica mayor del tono. Si el tono es menor (Am), se analiza con su relativo mayor (C).
  function majorTonic(key) {
    const chord = parseChord(key);
    if (!chord) return null;
    return chord.minor ? (chord.root + 3) % 12 : chord.root;
  }

  function degreeOf(chord, tonic) {
    return (chord.root - tonic + 12) % 12;
  }

  // ---------- Reglas ----------
  // Cada consejo: { badge, title, how, why, kind }  (kind: "antes" | "en lugar" | "encima" | "final")

  function suggestionsFor(index, list, tonic, name) {
    const cur = list[index];
    const prev = list[index - 1] || null;
    const next = list[index + 1] || null;
    const isLast = index === list.length - 1;
    if (!cur || cur.dim) return [];
    const deg = degreeOf(cur, tonic);
    const prevDeg = prev ? degreeOf(prev, tonic) : null;
    const nextDeg = next ? degreeOf(next, tonic) : null;
    const curName = cur.name;
    const tips = [];
    const add = (tip) => tips.push(tip);

    const I = name(tonic);
    const IV = name(tonic + 5);
    const V = name(tonic + 7);

    // I mayor
    if (deg === 0 && !cur.minor) {
      if (isLast) {
        add({
          badge: `${IV} · ${name(tonic + 5, "m")}`,
          title: "Final con IV menor",
          how: `${IV} → ${name(tonic + 5, "m")} → ${curName}`,
          why: `Para cerrar la alabanza, pasa por ${IV} y luego por ${name(tonic + 5, "m")} (el IV en menor, prestado del tono menor) antes del último ${curName}. Da un final muy emotivo, típico del gospel.`,
          kind: "final"
        });
      }
      if (prev && prevDeg !== 5) {
        add({
          badge: `${IV} (plagal)`,
          title: "Cadencia plagal",
          how: `${IV} → ${curName}`,
          why: `Toca ${IV} un momento (medio compás) justo antes de llegar a ${curName}. Es la cadencia IV → I, el "Amén" de los himnos: hace que la llegada se sienta más cálida y menos brusca.`,
          kind: "antes"
        });
      }
      if (nextDeg === 9) {
        add({
          badge: `Bajo ${name(tonic, "/" + name(tonic + 11))}`,
          title: "Bajo que camina",
          how: `${curName} → ${name(tonic, "/" + name(tonic + 11))} → ${next.name}`,
          why: `Entre ${curName} y ${next.name} baja el bajo por grados: ${I} – ${name(tonic + 11)} – ${name(tonic + 9)}. En el piano solo cambia la mano izquierda; en la guitarra se toca ${name(tonic, "/" + name(tonic + 11))}.`,
          kind: "antes"
        });
      }
      if (nextDeg === 5 && !isLast) {
        add({
          badge: `${name(tonic, "7")} → ${IV}`,
          title: "Dominante del IV",
          how: `${curName} → ${name(tonic, "7")} → ${next.name}`,
          why: `Agrega la séptima a ${curName} (${name(tonic, "7")}) justo antes de ir a ${next.name}. Así ${curName} "empuja" hacia ${next.name}, como si fuera su dominante.`,
          kind: "en lugar"
        });
      }
      add({
        badge: `${name(tonic, "add9")}`,
        title: "Color: add9",
        how: `${name(tonic, "add9")} en lugar de ${curName}`,
        why: `Agrega la novena (${name(tonic + 2)}) al acorde. Suena más abierto y moderno sin cambiar la función. En guitarra y piano es muy usado en adoración contemporánea.`,
        kind: "en lugar"
      });
    }

    // V mayor
    if (deg === 7 && !cur.minor) {
      if (nextDeg === 0 || nextDeg === 9 || !next) {
        add({
          badge: `${name(tonic + 7, "sus4")} → ${V}`,
          title: "Suspensión",
          how: `${name(tonic + 7, "sus4")} → ${curName}`,
          why: `Toca primero ${name(tonic + 7, "sus4")} (cambia la tercera por la cuarta) y resuelve a ${curName}. Crea una pequeña tensión que se resuelve; queda muy bien al final de una frase.`,
          kind: "antes"
        });
      }
      if (prevDeg !== 2) {
        add({
          badge: `${name(tonic + 2)} (V de ${V})`,
          title: "Dominante secundaria",
          how: `${name(tonic + 2)} → ${curName}`,
          why: `${name(tonic + 2)} es el acorde que "lleva" a ${curName} (su dominante). Tócalo brevemente antes de ${curName} para darle más fuerza a la llegada.`,
          kind: "antes"
        });
      }
      add({
        badge: "Escala mixolidia",
        title: "Para el solista",
        how: `${V} mixolidia sobre ${curName}`,
        why: `Sobre ${curName} se puede improvisar con la escala de ${I} mayor empezando en ${V} (modo mixolidio). Las notas ${name(tonic + 7)}–${name(tonic + 11)}–${name(tonic + 2)}–${name(tonic + 5)} marcan bien el acorde.`,
        kind: "encima"
      });
    }

    // vi menor
    if (deg === 9 && cur.minor) {
      if (prevDeg === 7) {
        add({
          badge: `${name(tonic + 8, "°")} de paso`,
          title: "Disminuido de paso",
          how: `${prev.name} → ${name(tonic + 8, "dim")} → ${curName}`,
          why: `Entre ${prev.name} y ${curName} hay un tono; llénalo con ${name(tonic + 8, "dim")} (sube medio tono). El bajo sube ${name(tonic + 7)} – ${name(tonic + 8)} – ${name(tonic + 9)} y suena muy fluido.`,
          kind: "antes"
        });
      }
      add({
        badge: `Slide ${name(tonic + 8, "m")}`,
        title: "Slide cromático",
        how: `${name(tonic + 8, "m")} → ${curName}`,
        why: `Toca el mismo acorde medio tono abajo (${name(tonic + 8, "m")}) y deslízalo a ${curName}. En la guitarra con cejilla es solo mover un traste; en el piano, un adorno rápido.`,
        kind: "antes"
      });
      add({
        badge: `${name(tonic + 4, "7")} (V de ${curName})`,
        title: "Dominante secundaria",
        how: `${name(tonic + 4, "7")} → ${curName}`,
        why: `${name(tonic + 4, "7")} es la dominante de ${curName}. Ponlo antes de ${curName} para un giro más dramático, muy usado en himnos y gospel.`,
        kind: "antes"
      });
    }

    // IV mayor
    if (deg === 5 && !cur.minor) {
      add({
        badge: "Escala lidia (cuarta #)",
        title: "Para el solista",
        how: `${IV} lidia sobre ${curName}`,
        why: `Sobre ${curName} usa la escala de ${I} mayor empezando en ${IV} (modo lidio). Su nota característica es ${name(tonic + 11)}, la cuarta aumentada de ${IV}: da un sonido brillante, como "flotando".`,
        kind: "encima"
      });
      add({
        badge: `${name(tonic + 5, "maj7")}`,
        title: "Color: maj7",
        how: `${name(tonic + 5, "maj7")} en lugar de ${curName}`,
        why: `Agrega la séptima mayor (${name(tonic + 4)}). Suena suave y abierto; queda muy bien en partes tranquilas o en el puente.`,
        kind: "en lugar"
      });
      if (nextDeg === 0) {
        add({
          badge: `${name(tonic + 5, "m")} (IV menor)`,
          title: "IV menor prestado",
          how: `${curName} → ${name(tonic + 5, "m")} → ${next.name}`,
          why: `Antes de volver a ${next.name}, cambia ${curName} por ${name(tonic + 5, "m")} un momento. Es un acorde prestado del tono menor y da mucha emoción.`,
          kind: "antes"
        });
      }
    }

    // ii menor
    if (deg === 2 && cur.minor) {
      if (prevDeg === 0) {
        add({
          badge: `${name(tonic + 1, "°")} de paso`,
          title: "Disminuido de paso",
          how: `${prev.name} → ${name(tonic + 1, "dim")} → ${curName}`,
          why: `Entre ${prev.name} y ${curName}, ${name(tonic + 1, "dim")} hace que el bajo suba por semitonos (${name(tonic)} – ${name(tonic + 1)} – ${name(tonic + 2)}).`,
          kind: "antes"
        });
      }
      add({
        badge: `${name(tonic + 9, "7")} (V de ${curName})`,
        title: "Dominante secundaria",
        how: `${name(tonic + 9, "7")} → ${curName}`,
        why: `${name(tonic + 9, "7")} es la dominante de ${curName}. Tócalo antes para darle dirección.`,
        kind: "antes"
      });
    }

    // iii menor
    if (deg === 4 && cur.minor) {
      add({
        badge: `${name(tonic + 11, "7")} (V de ${curName})`,
        title: "Dominante secundaria",
        how: `${name(tonic + 11, "7")} → ${curName}`,
        why: `${name(tonic + 11, "7")} es la dominante de ${curName}.`,
        kind: "antes"
      });
    }

    return tips;
  }

  // Devuelve, para cada acorde (en orden), su lista de consejos. El primero es el que se muestra.
  // Para no llenar la hoja, un mismo consejo principal no se repite en acordes seguidos iguales:
  // se alterna entre las opciones de ese acorde.
  function analyze(chordNames, key, preferFlats) {
    const tonic = majorTonic(key);
    if (tonic === null) return chordNames.map(() => []);
    const name = makeNamer(preferFlats);
    const parsed = chordNames.map(parseChord);
    const valid = parsed.map((c, i) => ({ c, i })).filter((x) => x.c);
    const result = chordNames.map(() => []);
    const shownCount = new Map();

    valid.forEach((entry, position) => {
      const list = valid.map((x) => x.c);
      const tips = suggestionsFor(position, list, tonic, name);
      if (!tips.length) return;
      // Rotar: si el consejo principal ya se mostró varias veces, mostrar otro de la lista.
      const used = (badgeKey) => shownCount.get(badgeKey) || 0;
      let best = 0;
      tips.forEach((tip, i) => {
        if (used(tip.title + tip.badge) < used(tips[best].title + tips[best].badge)) best = i;
      });
      const ordered = [tips[best], ...tips.filter((_, i) => i !== best)];
      const key0 = ordered[0].title + ordered[0].badge;
      shownCount.set(key0, used(key0) + 1);
      result[entry.i] = ordered;
    });
    return result;
  }

  // ---------- En la hoja ----------

  // Coloca una etiqueta encima de cada acorde que tenga consejo. `onOpen(tips, chordName)` se
  // llama al tocar una etiqueta.
  function decorate(container, key, preferFlats, onOpen) {
    const chordEls = [...container.querySelectorAll(".cs-line.has-chords:not(.chords-only) .cs-chord")]
      .filter((el) => el.textContent.trim());
    const all = analyze(chordEls.map((el) => el.textContent.trim()), key, preferFlats);
    chordEls.forEach((el, i) => {
      const tips = all[i];
      if (!tips.length) return;
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = `cs-tip cs-tip-${tips[0].kind.replace(/\s+/g, "-")}`;
      badge.textContent = tips[0].badge;
      badge.title = `${tips[0].title}: ${tips[0].how}`;
      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        onOpen(tips, el.textContent.trim());
      });
      el.parentElement.appendChild(badge);
      el.closest(".cs-line").classList.add("has-tips");
    });
    layout(container);
  }

  // Si dos etiquetas de la misma fila se tocan, la segunda sube un piso.
  function layout(container) {
    container.querySelectorAll(".cs-line.has-tips").forEach((line) => {
      const tips = [...line.querySelectorAll(".cs-tip")];
      tips.forEach((tip) => {
        tip.style.setProperty("--tier", "0");
        tip.style.removeProperty("--shift");
      });
      line.style.setProperty("--tip-rows", "1");
      line.style.setProperty("--tip-h", `${(tips[0]?.offsetHeight || 18) + 4}px`);
      const lineRect = line.getBoundingClientRect();
      const rows = new Map(); // fila visual → etiquetas colocadas [{left,right,tier}]
      let maxTier = 0;
      tips.forEach((tip) => {
        let rect = tip.getBoundingClientRect();
        // Que no se salga por la derecha.
        const overflow = rect.right - lineRect.right;
        if (overflow > 0) {
          tip.style.setProperty("--shift", `${-overflow}px`);
          rect = tip.getBoundingClientRect();
        }
        const rowKey = Math.round(tip.parentElement.getBoundingClientRect().bottom);
        const placed = rows.get(rowKey) || [];
        let tier = 0;
        while (placed.some((p) => p.tier === tier && rect.left < p.right + 4 && rect.right > p.left - 4)) tier += 1;
        placed.push({ left: rect.left, right: rect.right, tier });
        rows.set(rowKey, placed);
        tip.style.setProperty("--tier", String(tier));
        maxTier = Math.max(maxTier, tier);
      });
      line.style.setProperty("--tip-rows", String(maxTier + 1));
    });
  }

  window.ChordTips = { analyze, decorate, layout };
})();
