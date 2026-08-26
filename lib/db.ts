import dns from "node:dns";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see scoring-spec.md)."
  );
}

const dbUrl = new URL(process.env.DATABASE_URL);
const originalHost = dbUrl.hostname;

let poolPromise: Promise<Pool> | null = null;

async function createPool(): Promise<Pool> {
  // Some local networks refuse to resolve certain neon.tech hostnames
  // through their default DNS resolver (confirmed on this project's dev
  // machine). Resolving explicitly against a public resolver and
  // connecting by IP works around that; TLS still validates against the
  // real hostname via `servername`, so this stays secure. This has no
  // downside where DNS already works fine (e.g. on Vercel).
  const resolver = new dns.promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const [ip] = await resolver.resolve4(originalHost);

  return new Pool({
    host: ip,
    port: Number(dbUrl.port) || 5432,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: true, servername: originalHost },
    max: 5,
  });
}

function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPool();
  return poolPromise;
}

/** Runs a parameterized query ($1, $2, ...) and returns its rows. */
export async function query<T = unknown>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}
