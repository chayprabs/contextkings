type QueryableDb = {
  exec: (sql: string) => Promise<unknown>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

let dbPromise: Promise<QueryableDb> | null = null;

export async function getBrowserDb() {
  if (typeof window === "undefined") {
    throw new Error("PGlite is only available in the browser.");
  }

  if (!dbPromise) {
    dbPromise = createDb();
  }

  return dbPromise;
}

async function createDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite({
    dataDir: "idb://contextkings",
    relaxedDurability: true,
  });

  await db.exec(`
    create table if not exists threads (
      id text primary key,
      title text not null,
      source_context_json text,
      updated_at text not null
    );

    create table if not exists messages (
      message_id text primary key,
      thread_id text not null,
      message_order integer not null,
      role text not null,
      parts_json text not null,
      created_at text not null
    );

    create table if not exists workflows (
      thread_id text primary key,
      workflow_json text not null,
      updated_at text not null
    );

    create table if not exists runs (
      run_id text primary key,
      thread_id text not null,
      workflow_id text not null,
      status text not null,
      run_json text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists records (
      id text primary key,
      run_id text not null,
      entity_type text not null,
      input_key text not null,
      source_hint text not null,
      raw_source_json text,
      crust_json text,
      derived_json text
    );

    create table if not exists artifacts (
      id text primary key,
      run_id text not null,
      kind text not null,
      content_json text not null,
      created_at text not null
    );
  `);

  return db;
}
