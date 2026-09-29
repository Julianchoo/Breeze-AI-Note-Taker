import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { db } from "./db"
import { ADMIN_EMAIL } from "./utils"

const microsoft = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // Microsoft is never a sign-in method: the admin links a personal account so meeting audio can be archived to OneDrive.
    ...(microsoft && {
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        tenantId: "consumers",
        disableSignUp: true,
        disableProfilePhoto: true,
        scope: ["Files.ReadWrite", "offline_access"],
      },
    }),
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      trustedProviders: ["microsoft"],
      // The Microsoft account's email may differ from the admin's Google email.
      allowDifferentEmails: true,
      // Security: without this, a Microsoft account showing the admin's email could sign in as the admin.
      // Existing Google users are unaffected: their Google account row is found by provider account id, not by email.
      disableImplicitLinking: true,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social" && ctx.body?.provider === "microsoft") throw new APIError("FORBIDDEN")
      if (ctx.path !== "/link-social") return
      const session = await getSessionFromCtx(ctx)
      if (session?.user.email !== ADMIN_EMAIL || !session.user.emailVerified) throw new APIError("FORBIDDEN")
    }),
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
