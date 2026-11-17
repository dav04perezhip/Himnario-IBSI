// Junta todos los archivos alabanzas/NNN.cho en un solo alabanzas.json que carga la app.
// Ejecutar cada vez que se agregue o corrija una alabanza:
//   node tools/empaquetar_alabanzas.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "alabanzas");
const bundle = {};

fs.readdirSync(DIR)
  .filter((file) => /^\d+\.cho$/.test(file))
  .sort()
  .forEach((file) => {
    const number = String(Number(file.replace(".cho", "")));
    bundle[number] = fs.readFileSync(path.join(DIR, file), "utf8").replace(/\r\n?/g, "\n");
  });

fs.writeFileSync(path.join(ROOT, "alabanzas.json"), JSON.stringify(bundle), "utf8");
console.log(`alabanzas.json: ${Object.keys(bundle).length} alabanzas`);
