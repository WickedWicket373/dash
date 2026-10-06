import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function upsertUser(
  db: Db,
  input: { name: string; email: string; password: string; role: "admin" | "user" },
) {
  const email = input.email.toLowerCase().trim();

  // already there? return their id
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));
  if (existing) return existing.id;

  if (input.password.length < 8) throw new Error(`Password for ${email} is too short`);

  // 1. the person
  const [created] = await db
    .insert(schema.user)
    .values({ id: crypto.randomUUID(), name: input.name, email, emailVerified: true, role: input.role })
    .returning({ id: schema.user.id });

  // 2. how they log in: a "credential" account holding the hashed password
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: created.id,
    providerId: "credential",
    userId: created.id,
    password: await hashPassword(input.password),
  });

  return created.id;
}

async function main() {
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to seed production.");

  const pool = new Pool({ connectionString: env("DATABASE_URL_UNPOOLED") });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  try {
    // 1. you
    const adminId = await upsertUser(db, {
      name: env("SEED_ADMIN_NAME"),
      email: env("SEED_ADMIN_EMAIL"),
      password: env("SEED_ADMIN_PASSWORD"),
      role: "admin",
    });

    // 2. demo business
    const slug = "demo-restaurants";
    let [org] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, slug));
    if (!org) {
      [org] = await db
        .insert(schema.organization)
        .values({
          id: crypto.randomUUID(),
          name: "Demo Restaurant Group",
          slug,
          industry: "restaurant",
          timezone: "America/Denver",
          createdAt: new Date(),
        })
        .returning({ id: schema.organization.id });
    }

    // 3. demo owner + membership
    const ownerId = await upsertUser(db, {
      name: "Demo Owner",
      email: "demo-owner@example.com",
      password: env("SEED_DEMO_PASSWORD"),
      role: "user",
    });
    const [membership] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.userId, ownerId));
    if (!membership) {
      await db.insert(schema.member).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        userId: ownerId,
        role: "owner",
        createdAt: new Date(),
      });
    }

    // 4. locations
    const existingLocations = await db
      .select({ id: schema.locations.id })
      .from(schema.locations)
      .where(eq(schema.locations.organizationId, org.id));
    if (existingLocations.length === 0) {
      await db.insert(schema.locations).values([
        { organizationId: org.id, name: "Downtown" },
        { organizationId: org.id, name: "Airport" },
      ]);
    }

    // 5. sample access request
    const [request] = await db
      .select({ id: schema.accessRequests.id })
      .from(schema.accessRequests)
      .where(eq(schema.accessRequests.email, "owner@sample-bistro.example"));
    if (!request) {
      await db.insert(schema.accessRequests).values({
        name: "Sam Sample",
        email: "owner@sample-bistro.example",
        company: "Sample Bistro",
        industry: "restaurant",
        locationCount: 3,
        systems: ["Square", "QuickBooks"],
      });
    }

    console.log("Seeded:", { adminId, organizationId: org.id, ownerId });
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});