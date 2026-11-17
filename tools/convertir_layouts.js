// Convierte hymn_layouts.json (coordenadas del PDF) al formato de texto con acordes
// anclados a la sílaba (estilo ChordPro), un archivo por alabanza en /alabanzas.
//
// Cada acorde se engancha al carácter de la línea de letra que tiene justo debajo,
// midiendo el ancho real de cada letra con las fuentes de Windows (Times New Roman / Arial).
//
// Uso:  node tools/convertir_layouts.js            (requiere opentype.js: npm i opentype.js)

const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "alabanzas");
const FONTS_DIR = process.env.FONTS_DIR || "C:/Windows/Fonts";

const FONT_FILES = {
  "Times New Roman|400|normal": "times.ttf",
  "Times New Roman|700|normal": "timesbd.ttf",
  "Times New Roman|400|italic": "timesi.ttf",
  "Times New Roman|700|italic": "timesbi.ttf",
  "Arial|400|normal": "arial.ttf",
  "Arial|700|normal": "arialbd.ttf",
  "Arial|400|italic": "ariali.ttf",
  "Arial|700|italic": "arialbi.ttf"
};
const fontCache = {};

function getFont(item) {
  const weight = Number(item.fontWeight) >= 600 ? 700 : 400;
  const key = `${item.fontFamily}|${weight}|${item.fontStyle === "italic" ? "italic" : "normal"}`;
  const file = FONT_FILES[key] || FONT_FILES["Times New Roman|400|normal"];
  if (!fontCache[file]) fontCache[file] = opentype.loadSync(path.join(FONTS_DIR, file));
  return fontCache[file];
}

function advance(font, text, size) {
  return font.getAdvanceWidth(text, size, { kerning: false });
}

const layouts = JSON.parse(fs.readFileSync(path.join(ROOT, "hymn_layouts.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "hymns.json"), "utf8"));

const CHORD_TO_LYRIC_MAX_GAP = 22;
const stats = { chords: 0, worstError: 0, worstAt: "", over2pt: 0, chordOnlyLines: 0 };

function groupRows(items) {
  const rows = [];
  [...items].sort((a, b) => a.y - b.y || a.x - b.x).forEach((item) => {
    const row = rows.find((r) => Math.abs(r.y - item.y) < 1.5);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  });
  rows.forEach((row) => {
    row.items.sort((a, b) => a.x - b.x);
    row.isChordRow = row.items.every((i) => i.isChord);
  });
  return rows;
}

// Construye la línea de texto y la posición x de cada carácter.
function buildLyricLine(row) {
  let text = "";
  const charX = []; // x de inicio de cada carácter de `text`
  row.items.forEach((item, index) => {
    const font = getFont(item);
    if (index > 0) {
      const prev = row.items[index - 1];
      charX.push(prev._endX);
      text += " ";
    }
    let x = item.x;
    for (const ch of item.text) {
      charX.push(x);
      text += ch;
      x += advance(font, ch, item.fontSize);
    }
    item._endX = x;
  });
  charX.push(row.items.length ? row.items[row.items.length - 1]._endX : 0);
  return { text, charX };
}

function attachChords(chordRow, lyric, label) {
  const { text, charX } = lyric;
  const anchors = []; // { index, chord }
  chordRow.items.forEach((chord) => {
    stats.chords += 1;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < charX.length; i += 1) {
      // No anclar a un espacio si la letra siguiente está casi igual de cerca.
      const dist = Math.abs(charX[i] - chord.x) + (text[i] === " " ? 0.5 : 0);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    // Acorde más allá del final de la línea: se rellena con espacios.
    const lastX = charX[charX.length - 1];
    if (chord.x > lastX + 6) {
      const spaceWidth = 3;
      const pad = Math.max(1, Math.round((chord.x - lastX) / spaceWidth));
      anchors.push({ index: text.length, pad, chord: chord.text });
      return;
    }
    if (bestDist > stats.worstError) {
      stats.worstError = bestDist;
      stats.worstAt = `${label} "${chord.text}"`;
    }
    if (bestDist > 2) stats.over2pt += 1;
    stats.signed = stats.signed || {};
    const bucket = Math.round(chord.x - charX[best]);
    stats.signed[bucket] = (stats.signed[bucket] || 0) + 1;
    anchors.push({ index: best, chord: chord.text });
  });

  let out = "";
  let cursor = 0;
  let extraPad = "";
  anchors.sort((a, b) => a.index - b.index);
  anchors.forEach((anchor) => {
    out += text.slice(cursor, anchor.index);
    cursor = anchor.index;
    if (anchor.pad) {
      extraPad = " ".repeat(Math.min(anchor.pad, 4));
      out += extraPad;
    }
    out += `[${anchor.chord}]`;
  });
  out += text.slice(cursor);
  return out.replace(/\s+$/, "");
}

function chordOnlyLine(row) {
  stats.chordOnlyLines += 1;
  return row.items.map((i) => `[${i.text}]`).join(" ");
}

function mixedLine(row) {
  return row.items.map((i) => (i.isChord ? `[${i.text}]` : i.text)).join(" ");
}

function convert(number, layout) {
  const meta = catalog.find((h) => String(h.number) === String(number)) || {};
  const rows = groupRows(layout.items);

  // Quitar encabezado: título ("216. BONDAD DE DIOS") y artista centrado.
  let start = 0;
  const firstChordRow = rows.findIndex((r) => r.isChordRow);
  while (start < rows.length && start < (firstChordRow < 0 ? 2 : firstChordRow)) {
    const row = rows[start];
    const firstText = row.items[0].text;
    const isTitle = start === 0 && new RegExp(`^${number}\\.`).test(firstText);
    const isCentered = row.items.some((i) => i.textAnchor === "middle");
    if (isTitle || isCentered) start += 1;
    else break;
  }

  const body = rows.slice(start);
  const lines = [];
  let prevY = null;
  let typicalGap = null;
  const gaps = [];

  for (let i = 0; i < body.length; i += 1) {
    const row = body[i];
    const next = body[i + 1];
    let line;
    let usedRows = 1;

    if (row.isChordRow && next && !next.isChordRow && next.y - row.y <= CHORD_TO_LYRIC_MAX_GAP) {
      line = attachChords(row, buildLyricLine(next), `#${number} y=${Math.round(row.y)}`);
      usedRows = 2;
    } else if (row.isChordRow) {
      line = chordOnlyLine(row);
    } else if (row.items.some((it) => it.isChord)) {
      line = mixedLine(row);
    } else {
      line = buildLyricLine(row).text;
    }

    const lineY = row.y;
    if (prevY !== null) gaps.push(lineY - prevY);
    prevY = lineY;
    lines.push({ y: lineY, text: line });
    i += usedRows - 1;
  }

  // Separación de estrofas: un salto vertical claramente mayor que el habitual.
  const sorted = [...gaps].sort((a, b) => a - b);
  typicalGap = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 25;

  const header = [`{title: ${meta.title || ""}}`];
  if (meta.artist) header.push(`{artist: ${meta.artist}}`);
  if (meta.originalKey) header.push(`{key: ${meta.originalKey}}`);
  if (meta.preferFlats) header.push(`{flats: true}`);

  const bodyLines = [];
  let lastEnd = null;
  lines.forEach((line, idx) => {
    if (idx > 0 && line.y - lastEnd > typicalGap * 1.45) bodyLines.push("");
    bodyLines.push(line.text);
    lastEnd = line.y;
  });

  return `${header.join("\n")}\n\n${bodyLines.join("\n")}\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
Object.entries(layouts).forEach(([number, layout]) => {
  const file = path.join(OUT_DIR, `${String(number).padStart(3, "0")}.cho`);
  fs.writeFileSync(file, convert(number, layout), "utf8");
});

console.log(`Alabanzas convertidas: ${Object.keys(layouts).length}`);
console.log(`Acordes anclados: ${stats.chords}`);
console.log(`Acordes a más de 2pt de una letra: ${stats.over2pt}`);
console.log(`Mayor desfase: ${stats.worstError.toFixed(2)}pt en ${stats.worstAt}`);
if (process.env.DEBUG) console.log(stats.signed);
console.log(`Líneas solo de acordes (intros, etc.): ${stats.chordOnlyLines}`);
