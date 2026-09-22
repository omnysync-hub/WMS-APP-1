import * as SQLite from "expo-sqlite";
import { FULL_SCHEMA } from "@/db/schema";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("workman_companion.db");
      await db.execAsync(FULL_SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

export async function initDatabase() {
  return getDatabase();
}
