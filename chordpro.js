// Formato de alabanzas del Himnario IBSI.
//
// Internamente cada alabanza se guarda con el acorde entre corchetes justo antes de
// la sílaba donde se toca:   [G]Majes[C]tad, a[D]dora a su ma[G]jestad
// En pantalla siempre se dibuja con el acorde ARRIBA de esa sílaba.

(function () {
  const SECTION_WORDS =
    "coro|puente|pre-?coro|precoro|intro|introducci[oó]n|final|estribillo|verso|estrofa|interludio|outro|instrumental|solo|tag|coda";
  const SECTION_LINE = new RegExp(`^\\s*(?:${SECTION_WORDS})(?:\\s*\\d+)?\\s*:?\\s*(?:\\(?x\\s*\\d+\\)?)?\\s*$`, "i");
  const SECTION_PREFIX = new RegExp(`^\\s*((?:${SECTION_WORDS})(?:\\s*\\d+)?\\s*:)\\s*`, "i");
  // "Nota" sola en su línea marca que el bloque siguiente es una nota (no se canta).
  const NOTE_LINE = /^\s*nota\s*:?\s*$/i;
  const VERSE_LABEL = /^(estrofa|verso)\s*(\d+)?$/i;

  const CHORD_RE =
    /^\(?[A-G](?:#|b)?(?:maj|min|m|M|dim|aug|sus|add|º|°|\+|-)?[0-9]*(?:\([^)]*\))?(?:(?:sus|add|maj|M|b|#)?[0-9]+)*(?:\/[A-G](?:#|b)?)?\)?$/;
  const IGNORABLE_TOKEN = /^(\||\/|-+|x\d+|\(x\d+\)|\d+x|\.+|:|%)$/i;

  function isChordToken(token) {
    return CHORD_RE.test(token);
  }

  // ---------- Lectura del formato ----------

  function parse(source) {
    const meta = {};
    const lines = [];

    String(source || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .forEach((raw) => {
        const directive = /^\s*\{\s*([a-z_]+)\s*:\s*(.*?)\s*\}\s*$/i.exec(raw);
        if (directive) {
          const name = directive[1].toLowerCase();
          if (name === "comment" || name === "c" || name === "section") {
            lines.push({ type: "section", text: directive[2] });
          } else {
            meta[name] = directive[2];
          }
          return;
        }

        if (!raw.trim()) {
          lines.push({ type: "empty" });
          return;
        }

        let text = raw.replace(/\s+$/, "");
        const plain = text.replace(/\[[^\]]*\]/g, "");

        if ((SECTION_LINE.test(plain) || NOTE_LINE.test(plain)) && !/\[/.test(text)) {
          lines.push({ type: "section", text: plain.trim() });
          return;
        }

        // "CORO: letra…", también con acordes pegados a la etiqueta ("CORO[G]: …", "CORO:[A] …").
        const prefix = SECTION_PREFIX.exec(plain);
        if (prefix) {
          let consumed = 0;
          let index = 0;
          let movedChords = "";
          while (index < text.length && consumed < prefix[0].length) {
            if (text[index] === "[") {
              const close = text.indexOf("]", index);
              if (close < 0) break;
              movedChords += text.slice(index, close + 1);
              index = close + 1;
              continue;
            }
            index += 1;
            consumed += 1;
          }
          lines.push({ type: "section", text: prefix[1].trim() });
          text = movedChords + text.slice(index);
          if (!text.trim()) return;
        }

        lines.push({ type: "lyric", segments: splitSegments(text) });
      });

    // Quitar líneas vacías al inicio y al final, y vacías repetidas.
    while (lines.length && lines[0].type === "empty") lines.shift();
    while (lines.length && lines[lines.length - 1].type === "empty") lines.pop();
    const compact = lines.filter(
      (line, index) => !(line.type === "empty" && lines[index - 1]?.type === "empty")
    );

    return { meta, lines: compact };
  }

  function splitSegments(text) {
    const segments = [];
    const re = /\[([^\]]*)\]/g;
    let last = 0;
    let pendingChord = null;
    let match;

    while ((match = re.exec(text))) {
      const before = text.slice(last, match.index);
      if (before || pendingChord !== null) {
        segments.push({ chord: pendingChord, text: before });
      }
      pendingChord = match[1].trim();
      last = re.lastIndex;
    }
    const rest = text.slice(last);
    if (rest || pendingChord !== null) segments.push({ chord: pendingChord, text: rest });
    return segments;
  }

  // ---------- Dibujo con acordes arriba ----------

  function render(parsed, options = {}) {
    const transpose = options.transposeChord || ((chord) => chord);
    const showChords = options.showChords !== false;
    const container = document.createElement("div");
    container.className = "chord-sheet-body";

    groupStanzas(parsed.lines).forEach((group) => {
      const stanza = document.createElement("section");
      stanza.className = `cs-stanza${group.kind ? ` cs-${group.kind}` : ""}`;
      if (group.repeat) stanza.classList.add("cs-repeat");
      if (group.label && !group.hideLabel) {
        const label = document.createElement("div");
        label.className = "cs-section";
        label.textContent = group.label;
        stanza.appendChild(label);
      }
      group.lines.forEach((line) => stanza.appendChild(renderLine(line.segments, transpose, showChords)));
      container.appendChild(stanza);
    });
    return container;
  }

  // Agrupa las líneas en bloques (separados por línea vacía o por una etiqueta como CORO).
  // Lo que el usuario marca a mano (Coro, Puente, Estrofa, Nota…) siempre manda.
  // Los bloques con letra que no traen etiqueta se numeran: Estrofa 1, Estrofa 2…
  // Una etiqueta sola, sin letra debajo (p. ej. "Coro" otra vez), se muestra como aviso de repetir.
  function groupStanzas(lines) {
    const groups = [];
    let current = { label: "", lines: [] };
    const close = () => {
      if (current.lines.length || current.label) groups.push(current);
      current = { label: "", lines: [] };
    };

    lines.forEach((line) => {
      if (line.type === "empty") {
        // "Coro" + línea vacía + letra: la etiqueta sigue siendo de la letra que viene.
        if (current.lines.length) close();
      } else if (line.type === "section") {
        close();
        current.label = line.text.replace(/:\s*$/, "").trim();
        current.explicit = true;
      } else {
        current.lines.push(line);
      }
    });
    close();

    const lineText = (l) => l.segments.map((s) => s.text).join("");
    const hasLyrics = (group) => group.lines.some((l) => lineText(l).trim());
    groups.forEach((group) => {
      const startsWithNota = group.lines.length && /^\s*nota\b/i.test(lineText(group.lines[0]));
      if (/^nota$/i.test(group.label)) {
        group.kind = "note";
        if (startsWithNota) group.hideLabel = true;
      } else if (!group.label && startsWithNota) {
        group.kind = "note";
      }
    });
    const lyricGroups = groups.filter((g) => hasLyrics(g) && g.kind !== "note");
    const lastLyric = lyricGroups[lyricGroups.length - 1];
    const autoVerses = lyricGroups.length >= 2 || lyricGroups.some((g) => g.explicit);
    let verse = 0;
    groups.forEach((group) => {
      if (/^(coro|estribillo)/i.test(group.label)) group.kind = "chorus";
      const verseLabel = VERSE_LABEL.exec(group.label);
      if (verseLabel) {
        // "Estrofa" sin número se numera sola; "Estrofa 3" fija el conteo en 3.
        verse = verseLabel[2] ? Number(verseLabel[2]) : verse + 1;
        group.label = `${verseLabel[1].charAt(0).toUpperCase()}${verseLabel[1].slice(1).toLowerCase()} ${verse}`;
        group.kind = "verse";
        return;
      }
      if (group.label || group.kind === "note" || !hasLyrics(group) || !autoVerses) return;
      // Una sola línea al final, después de varias estrofas: es el cierre de la alabanza.
      if (group === lastLyric && group.lines.length === 1 && lyricGroups.length >= 3) {
        group.label = "Final";
        return;
      }
      verse += 1;
      group.label = `Estrofa ${verse}`;
      group.kind = "verse";
    });
    // Una etiqueta sin letra que ya salió antes (p. ej. "Coro"): se canta otra vez esa parte.
    const seen = new Set();
    groups.forEach((group) => {
      const key = group.label.toLowerCase();
      if (!group.lines.length && seen.has(key)) group.repeat = true;
      if (group.lines.length) seen.add(key);
    });
    return groups;
  }

  // Devuelve el texto con cada división escrita a mano ("Estrofa", "Coro", "Final"…),
  // para que se pueda ver y cambiar en el editor. Se ve igual que antes de escribirlas.
  function withSectionLabels(source) {
    const parsed = parse(source);
    const out = [];
    groupStanzas(parsed.lines).forEach((group) => {
      if (out.length) out.push("");
      let label = group.label;
      if (group.kind === "verse" && VERSE_LABEL.test(label)) label = label.replace(/\s*\d+$/, "");
      if (label && !group.hideLabel && !(group.kind === "note" && !group.explicit)) out.push(label);
      group.lines.forEach((line) => {
        out.push(line.segments.map((s) => `${s.chord !== null ? `[${s.chord}]` : ""}${s.text}`).join(""));
      });
    });
    return out.join("\n");
  }

  function renderLine(segments, transpose, showChords) {
    const lineEl = document.createElement("div");
    const hasLyrics = segments.some((s) => s.text.trim());
    const hasChords = showChords && segments.some((s) => s.chord);
    lineEl.className = `cs-line${hasChords ? " has-chords" : ""}${hasLyrics ? "" : " chords-only"}`;

    let word = null;
    const startWord = () => {
      word = document.createElement("span");
      word.className = "cs-word";
      lineEl.appendChild(word);
    };
    const addPiece = (chord, text) => {
      if (!word) startWord();
      const piece = document.createElement("span");
      piece.className = "cs-piece";
      if (hasChords) {
        const chordEl = document.createElement("span");
        chordEl.className = "cs-chord";
        chordEl.textContent = chord ? transpose(chord) : "";
        piece.appendChild(chordEl);
      }
      const lyricEl = document.createElement("span");
      lyricEl.className = "cs-lyric";
      lyricEl.textContent = text || " ";
      piece.appendChild(lyricEl);
      word.appendChild(piece);
    };

    segments.forEach((segment) => {
      if (!hasLyrics && !showChords) return;
      const parts = segment.text.split(/( +)/);
      let chord = showChords ? segment.chord : null;

      if (!parts.length || (parts.length === 1 && parts[0] === "")) {
        if (chord) addPiece(chord, "");
        return;
      }

      parts.forEach((part) => {
        if (/^ +$/.test(part)) {
          if (chord) {
            // Acorde sobre un espacio: queda en su propia columna.
            addPiece(chord, "");
            chord = null;
          }
          word = null;
          if (!hasLyrics) {
            const gap = document.createElement("span");
            gap.className = "cs-gap";
            lineEl.appendChild(gap);
          }
          return;
        }
        if (part === "" && !chord) return;
        addPiece(chord, part);
        chord = null;
      });
    });

    return lineEl;
  }

  // Los acordes flotan sobre la letra sin empujarla. Solo si un acorde chocaría con el
  // siguiente de la misma línea se abre espacio en la letra (como haría LaCuerda).
  // Debe llamarse con el contenido ya visible en la página.
  function fitChords(container) {
    container.querySelectorAll(".cs-piece.cs-spaced").forEach((piece) => {
      piece.style.paddingRight = "";
      piece.style.removeProperty("--cs-pad");
      piece.classList.remove("cs-spaced", "cs-midword");
    });

    container.querySelectorAll(".cs-line.has-chords:not(.chords-only)").forEach((line) => {
      const chords = [...line.querySelectorAll(".cs-chord")].filter((c) => c.textContent);
      for (let i = 0; i < chords.length - 1; i += 1) {
        const current = chords[i];
        const next = chords[i + 1];
        const a = current.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        if (Math.abs(a.top - b.top) > 2) continue; // el siguiente quedó en otra fila
        const minGap = parseFloat(getComputedStyle(current).fontSize) * 0.45;
        const overlap = a.right + minGap - b.left;
        if (overlap > 0.5) {
          const piece = current.parentElement;
          const extra = (parseFloat(piece.style.paddingRight) || 0) + overlap;
          piece.style.paddingRight = `${extra}px`;
          piece.style.setProperty("--cs-pad", `${extra}px`);
          piece.classList.add("cs-spaced");
          // Si la palabra continúa después del hueco, se marca con un guion: "TOD - OS".
          const lyric = piece.querySelector(".cs-lyric");
          const continues = piece.nextElementSibling && !/\s$/.test(lyric.textContent);
          piece.classList.toggle("cs-midword", Boolean(continues) && extra > 6);
        }
      }
    });
  }

  // ---------- Importar desde LaCuerda.net (acordes en la línea de arriba) ----------

  function isChordLine(line) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    const meaningful = tokens.filter((t) => !IGNORABLE_TOKEN.test(t));
    if (!meaningful.length) return false;
    return meaningful.every(isChordToken);
  }

  function chordPositions(line) {
    const positions = [];
    const re = /\S+/g;
    let match;
    while ((match = re.exec(line))) {
      if (isChordToken(match[0])) {
        positions.push({ column: match.index, chord: match[0].replace(/^\(|\)$/g, "") });
      }
    }
    return positions;
  }

  function mergeChordsIntoLyric(chordLine, lyricLine) {
    const positions = chordPositions(chordLine);
    let lyric = lyricLine.replace(/\s+$/, "");
    const lastColumn = positions.length ? positions[positions.length - 1].column : 0;
    if (lyric.length < lastColumn) lyric = lyric.padEnd(lastColumn, " ");

    for (let i = positions.length - 1; i >= 0; i -= 1) {
      const { column, chord } = positions[i];
      lyric = `${lyric.slice(0, column)}[${chord}]${lyric.slice(column)}`;
    }
    return lyric.replace(/\s+$/, "");
  }

  function chordLineOnly(chordLine) {
    return chordPositions(chordLine).map((p) => `[${p.chord}]`).join(" ");
  }

  function fromChordsOverLyrics(text) {
    const lines = String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ")
      .replace(/ /g, " ")
      .split("\n");
    const out = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].replace(/\s+$/, "");
      const next = lines[i + 1] !== undefined ? lines[i + 1].replace(/\s+$/, "") : undefined;

      // "Intro:  G   D/F#   Em   C"  →  etiqueta + línea de acordes
      const labelled = SECTION_PREFIX.exec(line);
      if (labelled && isChordLine(line.slice(labelled[0].length))) {
        out.push(labelled[1].trim());
        out.push(chordLineOnly(line.slice(labelled[0].length)));
        continue;
      }

      if (isChordLine(line)) {
        if (next !== undefined && next.trim() && !isChordLine(next)) {
          out.push(mergeChordsIntoLyric(line, next));
          i += 1;
        } else {
          out.push(chordLineOnly(line));
        }
        continue;
      }
      out.push(line);
    }

    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function looksLikeChordPro(text) {
    return /\[[A-G][^\]]*\]/.test(text) && !text.split("\n").some(isChordLine);
  }

  function firstChord(choText) {
    const match = /\[([A-G][#b]?m?)/.exec(String(choText || "").replace(/^\s*\{[^}]*\}\s*$/gm, ""));
    return match ? match[1] : "";
  }

  function stringify(meta, body) {
    const header = [];
    if (meta.title) header.push(`{title: ${meta.title}}`);
    if (meta.artist) header.push(`{artist: ${meta.artist}}`);
    if (meta.key) header.push(`{key: ${meta.key}}`);
    if (meta.flats) header.push("{flats: true}");
    return `${header.join("\n")}\n\n${body.trim()}\n`;
  }

  window.ChordPro = {
    parse,
    render,
    fitChords,
    fromChordsOverLyrics,
    looksLikeChordPro,
    isChordLine,
    firstChord,
    stringify,
    withSectionLabels
  };
})();
