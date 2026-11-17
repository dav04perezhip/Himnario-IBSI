-- Alabanzas de la 215 en adelante (las 1–214 son las originales y viven en la app).
-- `id` nunca cambia; `number` se recorre cuando se elimina una alabanza.
DROP TABLE IF EXISTS songs;

CREATE TABLE songs (
  id          TEXT    PRIMARY KEY,
  number      INTEGER NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  artist      TEXT    NOT NULL DEFAULT '',
  key         TEXT    NOT NULL DEFAULT 'C',
  flats       INTEGER NOT NULL DEFAULT 0,
  cho         TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
