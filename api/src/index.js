// API del Himnario IBSI (Cloudflare Worker + D1).
//
// Aquí viven las alabanzas de la 215 en adelante. Las 1–214 son las originales y están en la app.
//
//   GET    /songs        → todas (público, lo leen todos los teléfonos)
//   GET    /auth         → comprueba la clave de administrador
//   POST   /songs        → publicar una nueva (toma el número siguiente)        (requiere clave)
//   PUT    /songs/:id    → corregir una                                          (requiere clave)
//   DELETE /songs/:id    → eliminarla por completo; las siguientes se recorren   (requiere clave)
//   PUT    /fixes/:n     → corregir una original (1–214) para todos             (requiere clave)
//   DELETE /fixes/:n     → quitar la corrección y volver a la original          (requiere clave)
//
// GET /songs también devuelve `fixes`: las correcciones de las originales.
//
// Cada alabanza tiene un `id` que nunca cambia y un `number` que se recorre al eliminar.
// La clave va en  Authorization: Bearer <clave>  y se guarda en el secreto ADMIN_PIN.

const MAX_CHO = 40000;
const MAX_TEXT = 100;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const songMatch = /^\/songs\/([A-Za-z0-9-]{8,64})$/.exec(path);
      const fixMatch = /^\/fixes\/(\d{1,4})$/.exec(path);

      if (request.method === "GET" && path === "/songs") return listSongs(env, cors);
      if (request.method === "GET" && path === "/auth") {
        return isAdmin(request, env) ? json({ ok: true }, 200, cors) : unauthorized(cors);
      }

      if (path === "/songs" || songMatch) {
        if (!isAdmin(request, env)) return unauthorized(cors);
        if (request.method === "POST" && path === "/songs") return createSong(request, env, cors);
        if (request.method === "PUT" && songMatch) return updateSong(songMatch[1], request, env, cors);
        if (request.method === "DELETE" && songMatch) return deleteSong(songMatch[1], env, cors);
      }

      if (fixMatch) {
        if (!isAdmin(request, env)) return unauthorized(cors);
        const number = Number(fixMatch[1]);
        if (number < 1 || number >= Number(env.FIRST_NUMBER || 215)) {
          return json({ error: "Solo se pueden corregir las originales" }, 400, cors);
        }
        if (request.method === "PUT") return saveFix(number, request, env, cors);
        if (request.method === "DELETE") return deleteFix(number, env, cors);
      }

      return json({ error: "No encontrado" }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ error: "Error del servidor" }, 500, cors);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function unauthorized(cors) {
  return json({ error: "Clave de administrador incorrecta" }, 401, cors);
}

function isAdmin(request, env) {
  const expected = String(env.ADMIN_PIN || "");
  const header = request.headers.get("Authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function readSong(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: "Datos no válidos" };
  }
  const title = String(body.title || "").trim().slice(0, MAX_TEXT);
  const artist = String(body.artist || "").trim().slice(0, MAX_TEXT);
  const key = String(body.key || "C").trim().slice(0, 4) || "C";
  const flats = body.flats ? 1 : 0;
  const cho = String(body.cho || "");
  if (!title) return { error: "Falta el título" };
  if (!cho.trim() || !/\[[^\]]+\]/.test(cho)) return { error: "Falta la letra con acordes" };
  if (cho.length > MAX_CHO) return { error: "La alabanza es demasiado larga" };
  return { song: { title, artist, key, flats, cho } };
}

const COLUMNS = "id, number, title, artist, key, flats, cho, updated_at";

function toClient(row) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    artist: row.artist,
    originalKey: row.key,
    preferFlats: Boolean(row.flats),
    cho: row.cho,
    updatedAt: row.updated_at
  };
}

async function listSongs(env, cors) {
  const { results } = await env.DB.prepare(`SELECT ${COLUMNS} FROM songs ORDER BY number`).all();
  let fixes = [];
  try {
    const fixRows = await env.DB.prepare(
      "SELECT number, title, artist, key, flats, cho, updated_at FROM fixes ORDER BY number"
    ).all();
    fixes = fixRows.results.map(toClient);
  } catch (error) {
    // La tabla `fixes` todavía no existe (falta ejecutar fixes.sql): sin correcciones.
    if (!/no such table/i.test(String(error))) throw error;
  }
  return json({ songs: results.map(toClient), fixes, serverTime: Date.now() }, 200, cors);
}

async function saveFix(number, request, env, cors) {
  const { song, error } = await readSong(request);
  if (error) return json({ error }, 400, cors);
  const row = await env.DB.prepare(
    `INSERT INTO fixes (number, title, artist, key, flats, cho, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(number) DO UPDATE SET title = ?2, artist = ?3, key = ?4, flats = ?5, cho = ?6, updated_at = ?7
     RETURNING number, title, artist, key, flats, cho, updated_at`
  ).bind(number, song.title, song.artist, song.key, song.flats, song.cho, Date.now()).first();
  return json({ fix: toClient(row) }, 200, cors);
}

async function deleteFix(number, env, cors) {
  await env.DB.prepare("DELETE FROM fixes WHERE number = ?1").bind(number).run();
  return json({ ok: true }, 200, cors);
}

async function createSong(request, env, cors) {
  const { song, error } = await readSong(request);
  if (error) return json({ error }, 400, cors);

  const first = Number(env.FIRST_NUMBER || 215);
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO songs (id, number, title, artist, key, flats, cho, created_at, updated_at)
     VALUES (?1, (SELECT COALESCE(MAX(number) + 1, ?2) FROM songs), ?3, ?4, ?5, ?6, ?7, ?8, ?8)
     RETURNING ${COLUMNS}`
  ).bind(crypto.randomUUID(), first, song.title, song.artist, song.key, song.flats, song.cho, now).first();

  return json({ song: toClient(row) }, 201, cors);
}

async function updateSong(id, request, env, cors) {
  const { song, error } = await readSong(request);
  if (error) return json({ error }, 400, cors);

  const row = await env.DB.prepare(
    `UPDATE songs SET title = ?2, artist = ?3, key = ?4, flats = ?5, cho = ?6, updated_at = ?7
     WHERE id = ?1 RETURNING ${COLUMNS}`
  ).bind(id, song.title, song.artist, song.key, song.flats, song.cho, Date.now()).first();

  return row ? json({ song: toClient(row) }, 200, cors) : json({ error: "No existe" }, 404, cors);
}

async function deleteSong(id, env, cors) {
  const target = await env.DB.prepare("SELECT number FROM songs WHERE id = ?1").bind(id).first();
  if (!target) return json({ error: "No existe" }, 404, cors);

  // Borrar y recorrer en una sola transacción. Se pasa por números negativos para que
  // la columna única `number` nunca tenga dos iguales durante el cambio.
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM songs WHERE id = ?1").bind(id),
    env.DB.prepare("UPDATE songs SET number = -(number - 1), updated_at = ?2 WHERE number > ?1")
      .bind(target.number, now),
    env.DB.prepare("UPDATE songs SET number = -number WHERE number < 0")
  ]);

  return json({ ok: true, removedNumber: target.number }, 200, cors);
}
