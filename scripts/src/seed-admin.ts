import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

// Simple bcrypt-compatible hash using node's built-in crypto isn't available.
// Instead we use a raw SQL call to pgcrypto if available, or we install bcryptjs.
// This script uses pg directly and a bundled bcrypt implementation via crypt().

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check pgcrypto availability
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  } catch {
    // may already exist
  }

  // Check tenant
  let tenantId: number;
  const tenants = await client.query("SELECT id FROM tenants LIMIT 1");
  if (tenants.rows.length === 0) {
    const t = await client.query(
      "INSERT INTO tenants (name, slug, plan) VALUES ('Default', 'default', 'enterprise') RETURNING id"
    );
    tenantId = t.rows[0].id;
    console.log("Created tenant id:", tenantId);
  } else {
    tenantId = tenants.rows[0].id;
    console.log("Using existing tenant id:", tenantId);
  }

  // Use pgcrypto to generate bcrypt hash (cost 12)
  const result = await client.query(
    "SELECT crypt($1, gen_salt('bf', 12)) AS hash",
    ["Admin1234!"]
  );
  const hash: string = result.rows[0].hash;

  await client.query(
    `INSERT INTO users (email, password_hash, name, role, tenant_id, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ["admin@missioncontrol.local", hash, "Admin", "admin", tenantId]
  );

  console.log("✓ Admin user seeded");
  console.log("  Email:    admin@missioncontrol.local");
  console.log("  Password: Admin1234!");
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
