-- Correcciones de las alabanzas originales (1–214), hechas en modo administrador.
-- Se puede ejecutar las veces que haga falta: NO borra nada.
--   npx wrangler d1 execute himnario-ibsi --remote --file fixes.sql
CREATE TABLE IF NOT EXISTS fixes (
  number      INTEGER PRIMARY KEY,
  title       TEXT    NOT NULL,
  artist      TEXT    NOT NULL DEFAULT '',
  key         TEXT    NOT NULL DEFAULT 'C',
  flats       INTEGER NOT NULL DEFAULT 0,
  cho         TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);
