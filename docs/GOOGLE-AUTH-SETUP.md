# Optional Google identity rollout

Status: code complete, production flag off. Complete these checkpoints in order.

The implementation upgrades the current anonymous Supabase user with
`linkIdentity({ provider: "google" })`. That keeps the existing `auth.users.id`,
so projects, saved takes, and the consent receipt do not need to be copied.
Signing in to an already-connected account is a separate, warned flow because
PitchMi does not silently merge two users.

## 1. Create the Google OAuth web client

In Google Auth Platform:

1. Set the app name to **PitchMi** and use the production homepage and privacy
   page for the public links.
2. Choose the external audience required for public users.
3. Configure only `openid`, email, and profile. Do not add Drive, contacts,
   offline access, or any sensitive/restricted scope.
4. Create a **Web application** OAuth client.
5. Add this authorized JavaScript origin:
   `https://client-production-efa0.up.railway.app`
6. Add this authorized redirect URI:
   `https://ciknhdocqyuxlzsnhzbc.supabase.co/auth/v1/callback`
7. Store the client ID and secret in the password manager. Never put the secret
   in Git, `client/.env.local`, or a `NEXT_PUBLIC_*` variable.

Google brand verification can take time. The auth surface must remain disabled
until the consent screen clearly identifies PitchMi; a custom auth domain is a
later trust improvement, not a launch blocker.

## 2. Configure Supabase Auth

In project `ciknhdocqyuxlzsnhzbc`:

1. Authentication → Sign In / Providers → Google: enable the provider and enter
   the OAuth client ID and secret.
2. Authentication → General Configuration: keep anonymous sign-ins enabled and
   enable **Allow manual linking**.
3. Authentication → URL Configuration:
   - Site URL: `https://client-production-efa0.up.railway.app`
   - Redirect URL: `https://client-production-efa0.up.railway.app/auth/complete`
4. Do not use a wildcard production redirect.

For local UI/OAuth testing, temporarily add `http://localhost:3000` as a Google
JavaScript origin and `http://localhost:3000/auth/complete` to the Supabase
redirect allow list. The Google redirect URI still points to the hosted
Supabase callback above. Remove temporary production-console entries after the
test if they are no longer needed.

## 3. Update the consent contract

Connecting Google adds optional name/email processing. Before enabling the UI,
set a new matching consent version in:

- `client/src/lib/consent.ts`
- `server/src/lib/consent.js`

Update the consent tests that assert the literal version. Deploy client and
server together so the API never rejects the client’s current receipt.

## 4. Real end-to-end proof

Use a fresh browser profile and record the anonymous user ID before linking.

1. Accept consent, create a project, and confirm it is available.
2. Enable the flag only in a non-production/preview client build and choose
   **Save with Google**.
3. Confirm the callback succeeds, the user is no longer anonymous, the user ID
   is unchanged, and the original project remains visible to the same API JWT.
4. Sign out locally. Sign in with the same Google account and confirm the same
   user ID and project return.
5. In a second fresh profile, create temporary work and choose an already-linked
   Google account. Confirm linking fails safely and **Sign in instead** shows the
   separation warning before switching accounts.
6. Run **Delete my data** and verify owned rows, stored takes, and the permanent
   Auth user are deleted.

## 5. Expose in production

After the proof is green, set this Railway **client build** variable and redeploy:

```text
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

Because it is a Next.js public build variable, changing it requires a new client
build. Verify `/`, `/account`, `/auth/complete`, and `/privacy` after deployment.

Rollback is one variable change plus a client rebuild: set the flag to `false`.
Existing linked users and their data remain intact and can be re-exposed later.
