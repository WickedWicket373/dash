import "server-only"; // comment out temporarily for `npm run auth:generate`, then restore
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // invite-only
  },
  plugins: [
    admin(), // platform role on user (admin = you/staff)
    organization({
      allowUserToCreateOrganization: false, // only platform admins create tenants
      schema: {
        organization: {
          additionalFields: {
            industry: { type: "string", required: true },
            timezone: { type: "string", required: true },
          },
        },
      },
    }),
    nextCookies(), // must stay last
  ],
});
