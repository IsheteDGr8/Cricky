# Sentry (optional)

Sentry emails you when the app crashes, with a stack trace. The code is already
wired: if `EXPO_PUBLIC_SENTRY_DSN` is unset, nothing is sent.

## Is it worth doing now?

**Not yet.** You have no public new-app users. You can still see errors in the
browser or Metro console. The free tier is 5,000 events/month, which is plenty
later. Set this up when people start using the Expo app for real tournaments
(or when you cannot sit next to the scorer’s phone).

Skip the signup until then. The steps below are here so you do not have to
rediscover them.

## When you are ready

1. Open [https://sentry.io/signup](https://sentry.io/signup) and create a free
   **Developer** account.
2. Create an organization if it asks (any name, e.g. `cricky`).
3. Create a project:
   - Platform: **React Native** (Expo is fine).
   - Name: `cricky`.
4. Skip the install wizard. The app already calls `Sentry.init` when a DSN is
   present.
5. **Settings → Projects → cricky → Client Keys (DSN)**.
6. Copy the DSN. It looks like `https://examplePublicKey@o0.ingest.sentry.io/0`.
7. Copy `.env.example` to `.env.local` if you have not already:

   ```sh
   copy .env.example .env.local
   ```

8. In `.env.local` set:

   ```
   EXPO_PUBLIC_SENTRY_DSN=https://that-value-you-copied
   ```

9. Restart `npm run web`. `.env.local` is gitignored — do not commit it.

You will not see events until something throws. That is expected.
