import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  // Breeze signs people in with Google only. Email/password stayed enabled from
  // the starter kit with no UI behind it, and its reset and verification mails
  // were only ever written to the server console — so a reset could never reach
  // anyone. Re-enabling it means building those flows and wiring a real mail
  // provider; /forgot-password and /reset-password explain the situation.
  emailAndPassword: {
    enabled: false,
  },
})
