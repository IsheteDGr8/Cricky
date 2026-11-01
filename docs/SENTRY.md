# Sentry (crash reports)

The live website will send crashes here once the DSN is in `.env.local` and the
site is rebuilt. The DSN is a **public** client key (like the Firebase web
config). Never put a Sentry _auth token_ in the app.

## Do this once (about 5 minutes)

1. Open [https://sentry.io/signup](https://sentry.io/signup).
2. Sign up with **Google** (same Gmail you use for Firebase is fine).
3. If it asks for a plan, pick **Developer** (free).
4. Organization name: `cricky` (anything works).
5. Create a project:
   - Platform: **React Native**
   - Alert frequency: **On every new issue** (so you get an email)
   - Name: `cricky`
6. When it shows install instructions, **skip / close** them. The app is already wired.
7. Open **Settings** (gear) → **Projects** → **cricky** → **Client Keys (DSN)**.
8. Copy the DSN. It looks like:

   `https://something@o123.ingest.us.sentry.io/456`

9. Open `.env.local` in this repo and paste it:

   ```
   EXPO_PUBLIC_SENTRY_DSN=https://the-thing-you-copied
   ```

10. Tell the agent you pasted it. They will rebuild and deploy the live site.
    Until that deploy, the live site still has no Sentry.

You will not see events until something actually crashes. That is normal.
