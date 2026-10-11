import * as SQLite from "expo-sqlite";
import { FULL_SCHEMA } from "@/db/schema";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("workman_companion.db");
      await db.execAsync(FULL_SCHEMA);
      const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(pending_mutations)");
      if (!columns.some((column) => column.name === "ownerId")) {
        await db.execAsync("ALTER TABLE pending_mutations ADD COLUMN ownerId TEXT");
        // Old rows have no trustworthy owner. Dropping them is safer than
        // replaying field mutations under whichever employee signs in next.
        await db.execAsync("DELETE FROM pending_mutations WHERE ownerId IS NULL");
        await db.execAsync(
          "CREATE INDEX IF NOT EXISTS idx_pending_mutations_owner_created ON pending_mutations(ownerId, createdAt)"
        );
      }
      return db;
    })();
  }
  return dbPromise;
}

export async function initDatabase() {
  return getDatabase();
}
