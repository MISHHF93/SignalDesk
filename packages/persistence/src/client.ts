import { Pool, type PoolConfig } from "pg";

export type DatabasePool = Pool;

declare global {
  // eslint-disable-next-line no-var
  var _signaldeskPgPool: Pool | undefined;
}

export function createDatabasePool(config?: PoolConfig): DatabasePool {
  if (config) {
    return new Pool(config);
  }

  if (global._signaldeskPgPool) {
    return global._signaldeskPgPool;
  }

  const sqlHost = process.env.SQL_HOST;
  const sqlUser = process.env.SQL_USER;
  const sqlPassword = process.env.SQL_PASSWORD;
  const sqlDbName = process.env.SQL_DB_NAME;

  let pool: Pool;
  if (sqlHost && sqlUser) {
    pool = new Pool({
      host: sqlHost,
      user: sqlUser,
      password: sqlPassword,
      database: sqlDbName || "cloud_sql_development_database",
      max: 10,
      connectionTimeoutMillis: 15000,
    });
  } else {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
      throw new Error(
        "DATABASE_URL or SQL_HOST/SQL_USER is not set. The application must connect using the least-privilege app_runtime role.",
      );
    }
    if (raw.includes(":") && raw.split(":").length >= 3 && !raw.startsWith("postgres")) {
      pool = new Pool({
        host: `/app/cloudsql/${raw}`,
        user: sqlUser || "ai_studio_app_user",
        password: sqlPassword,
        database: sqlDbName || "cloud_sql_development_database",
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      pool = new Pool({
        connectionString: raw,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }
  }

  pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL pool client:", err);
  });

  global._signaldeskPgPool = pool;
  return pool;
}
