import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema.ts";

export type Database = NodePgDatabase<typeof schema>;

interface SharedDatabase {
  database?: Database;
  pool?: Pool;
}

type GlobalWithPetstoreDatabase = typeof globalThis & {
  __petstoreDatabase?: SharedDatabase;
};

function sharedDatabase(): SharedDatabase {
  const globalWithDatabase = globalThis as GlobalWithPetstoreDatabase;
  globalWithDatabase.__petstoreDatabase ??= {};
  return globalWithDatabase.__petstoreDatabase;
}

export function getDatabase(): Database {
  const shared = sharedDatabase();
  if (shared.database !== undefined) {
    return shared.database;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL must be set before using the Petstore API");
  }

  shared.pool ??= new Pool({ connectionString: databaseUrl });
  shared.database = drizzle(shared.pool, { schema });
  return shared.database;
}

export async function closeDatabase(): Promise<void> {
  const globalWithDatabase = globalThis as GlobalWithPetstoreDatabase;
  await globalWithDatabase.__petstoreDatabase?.pool?.end();
  delete globalWithDatabase.__petstoreDatabase;
}
