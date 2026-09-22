# Google sign-in

Login and registration offer **Continue with Google** through Better Auth. Successful authentication goes to `/dashboard`. A cancelled or failed callback returns to login with a retry message. Email/password authentication remains available.

## Vercel production configuration

Set these environment variables in the Breeze Vercel project, then redeploy:

| Variable | Value |
| --- | --- |
| `BETTER_AUTH_URL` | `https://breeze-ai-lime.vercel.app` |
| `BETTER_AUTH_SECRET` | Existing secret, at least 32 characters |
| `GOOGLE_CLIENT_ID` | Existing Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Existing Google OAuth web client secret |
| `POSTGRES_URL` | Project PostgreSQL connection string |

The auth client uses the current browser origin. `NEXT_PUBLIC_APP_URL` does not control authentication; it is still used for public site URLs such as the sitemap and robots file. Set it to `https://breeze-ai-lime.vercel.app` in production. Never expose secrets with a `NEXT_PUBLIC_` prefix.

## Google Cloud OAuth web client

Add this exact **Authorized redirect URI**:

```text
https://breeze-ai-lime.vercel.app/api/auth/callback/google
```

If configuring **Authorized JavaScript origins**, use `https://breeze-ai-lime.vercel.app` without a path. For local development use `BETTER_AUTH_URL=http://localhost:3000` and authorize `http://localhost:3000/api/auth/callback/google` separately.

If the Google consent screen is in testing mode, add the intended Google account as a test user.

## Verify after deployment

1. Open `/login` and click **Continue with Google**.
2. Confirm Google returns to `/dashboard` with an authenticated session.
3. Refresh, sign out, and sign in again.
4. Cancel Google consent and verify the login page shows a retry message.

No database schema changes are required: this uses the existing Better Auth user, account, and session tables. Google consent, production environment values, and a complete real-account callback must be verified in the deployed environment.

Reference: [Better Auth Google documentation](https://better-auth.com/docs/authentication/google).

