import { Pool, type PoolConfig } from "pg";

export type DatabasePool = Pool;

export function createDatabasePool(config?: PoolConfig): DatabasePool {
  const connectionString = config?.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The application must connect using the least-privilege app_runtime role, never the migration owner role.",
    );
  }

  return new Pool({
    ...config,
    connectionString,
  });
}
