CREATE TABLE IF NOT EXISTS songs (
  number      INTEGER PRIMARY KEY,
  title       TEXT    NOT NULL,
  artist      TEXT    NOT NULL DEFAULT '',
  key         TEXT    NOT NULL DEFAULT 'C',
  flats       INTEGER NOT NULL DEFAULT 0,
  cho         TEXT    NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS songs_updated ON songs (updated_at);
