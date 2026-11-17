// Genera api/seed_215_220.sql con las alabanzas 215–220 para cargarlas en la base de datos.
// Se usó una sola vez al pasar esas alabanzas a Cloudflare:
//   node tools/generar_semilla_215.js
//   (en api/)  npx wrangler d1 execute himnario-ibsi --remote --file seed_215_220.sql

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "hymns.json"), "utf8"));
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const now = Date.now();

const rows = catalog
  .filter((h) => h.number >= 215)
  .map((h) => {
    const cho = fs
      .readFileSync(path.join(ROOT, "alabanzas", `${String(h.number).padStart(3, "0")}.cho`), "utf8")
      .replace(/\r\n?/g, "\n");
    return `INSERT INTO songs (id, number, title, artist, key, flats, cho, created_at, updated_at) VALUES (${[
      q(crypto.randomUUID()), h.number, q(h.title), q(h.artist || ""), q(h.originalKey),
      h.preferFlats ? 1 : 0, q(cho), now, now
    ].join(", ")});`;
  });

fs.writeFileSync(path.join(ROOT, "api", "seed_215_220.sql"), rows.join("\n") + "\n", "utf8");
console.log(`seed_215_220.sql: ${rows.length} alabanzas`);
