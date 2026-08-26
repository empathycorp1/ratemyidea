// One-off setup script: creates the `submissions` table in the database
// pointed to by DATABASE_URL, over a direct TCP connection. Safe to run
// more than once (IF NOT EXISTS).
//
// Run it with: npm run db:migrate

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { readFileSync } from "node:fs";
import dns from "node:dns";
import { Client } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const dbUrl = new URL(process.env.DATABASE_URL);
const originalHost = dbUrl.hostname;

// This machine's local network DNS resolver refuses to answer for some
// neon.tech hostnames (confirmed: works fine against 8.8.8.8/1.1.1.1).
// Plain net.connect()/getaddrinfo (what `pg` uses by default) ignores
// dns.setServers(), so we resolve the address ourselves against a public
// resolver and connect to that IP directly — passing the original
// hostname as `servername` so TLS still validates the real certificate.
const resolver = new dns.promises.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);
const [ip] = await resolver.resolve4(originalHost);
console.log(`Resolved ${originalHost} -> ${ip} via public DNS.`);

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

const client = new Client({
  host: ip,
  port: Number(dbUrl.port) || 5432,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: true, servername: originalHost },
});

await client.connect();
try {
  await client.query(schema);
  console.log("Migration complete: the 'submissions' table is ready.");
} finally {
  await client.end();
}
