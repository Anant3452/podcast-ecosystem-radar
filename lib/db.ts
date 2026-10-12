import postgres from "postgres";

declare global {
  var __radarSql: postgres.Sql | undefined;
  var __radarSchemaReady: Promise<void> | undefined;
}

function client(): postgres.Sql {
  if (!globalThis.__radarSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalThis.__radarSql = postgres(url, {
      ssl: local ? false : "require",
      max: local ? 5 : 3,
      idle_timeout: 20,
      // Neon's pooled endpoint (pgbouncer, transaction mode) can't use prepared statements.
      prepare: false,
      onnotice: () => {},
    });
  }
  return globalThis.__radarSql;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shows (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  rss_url         text NOT NULL,
  last_fetched_at timestamptz,
  last_status     text,
  last_error      text
);

CREATE TABLE IF NOT EXISTS episodes (
  id             bigserial PRIMARY KEY,
  show_id        text NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  guid           text NOT NULL,
  title          text NOT NULL,
  published_at   timestamptz NOT NULL,
  description    text NOT NULL DEFAULT '',
  link           text,
  transcript_url text,
  extraction     jsonb,
  extracted_at   timestamptz,
  extract_error  text,
  extract_attempts int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, guid)
);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS link_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS episodes_published_idx ON episodes (published_at DESC);
CREATE INDEX IF NOT EXISTS episodes_pending_idx ON episodes (extracted_at) WHERE extracted_at IS NULL;

CREATE TABLE IF NOT EXISTS topic_canon (
  raw        text PRIMARY KEY,
  canonical  text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefs (
  id          bigserial PRIMARY KEY,
  week_of     date NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  headline    text NOT NULL,
  markdown    text NOT NULL,
  html        text NOT NULL,
  content     jsonb NOT NULL,
  analysis    jsonb NOT NULL,
  emailed_at  timestamptz,
  email_error text
);

CREATE TABLE IF NOT EXISTS runs (
  id          bigserial PRIMARY KEY,
  trigger     text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok          boolean,
  log         jsonb NOT NULL DEFAULT '{}'::jsonb
);
`;

/** Returns a ready-to-use client, creating tables on first use per process. */
export async function db(): Promise<postgres.Sql> {
  const sql = client();
  if (!globalThis.__radarSchemaReady) {
    globalThis.__radarSchemaReady = sql.unsafe(SCHEMA).then(() => undefined);
    globalThis.__radarSchemaReady.catch(() => {
      globalThis.__radarSchemaReady = undefined;
    });
  }
  await globalThis.__radarSchemaReady;
  return sql;
}

export async function closeDb(): Promise<void> {
  await globalThis.__radarSql?.end({ timeout: 5 });
  globalThis.__radarSql = undefined;
  globalThis.__radarSchemaReady = undefined;
}
