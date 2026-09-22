/** SQLite DDL — applied by db/database.ts */
export const LOCAL_JOBS_DDL = `
CREATE TABLE IF NOT EXISTS local_jobs (
  id TEXT PRIMARY KEY,
  jobNumber TEXT NOT NULL,
  status TEXT NOT NULL,
  customerJson TEXT NOT NULL,
  itemsJson TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
`;

export const PENDING_MUTATIONS_DDL = `
CREATE TABLE IF NOT EXISTS pending_mutations (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  retryCount INTEGER DEFAULT 0
);
`;

export const FULL_SCHEMA = `${LOCAL_JOBS_DDL}\n${PENDING_MUTATIONS_DDL}`;
