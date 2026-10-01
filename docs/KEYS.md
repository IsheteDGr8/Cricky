# Sentry and App Check (owner)

These are optional. The app runs without them. Do **not** turn on App Check
enforcement in Firebase until the v1 site is retired (Phase 7).

Copy `.env.example` to `.env.local` first:

```sh
copy .env.example .env.local
```

Then fill in the two values below. Restart `npm run web` after you save the file.
`.env.local` is gitignored — never commit it.

---

## 1. Sentry (crash reports, free)

1. Open [https://sentry.io/signup](https://sentry.io/signup) and create a free
   **Developer** account.
2. Create an organization if it asks (any name, e.g. `cricky`).
3. Create a project:
   - Platform: **React Native** (Expo is fine).
   - Name: `cricky`.
4. If a setup wizard appears, you can skip it. The app already calls
   `Sentry.init` when a DSN is present.
5. In Sentry: **Settings → Projects → cricky → Client Keys (DSN)**.
6. Copy the DSN. It looks like
   `https://examplePublicKey@o0.ingest.sentry.io/0`.
7. In `.env.local`, set:

   ```
   EXPO_PUBLIC_SENTRY_DSN=https://that-value-you-copied
   ```

8. Restart the app. You should see a test event if you force an error; otherwise
   it stays quiet until something crashes.

---

## 2. Firebase App Check + reCAPTCHA (web)

Goal: register the web app so it _can_ send App Check tokens. Leave enforcement
**off** so the live v1 site keeps working.

### A. Create a score-based reCAPTCHA key

1. Open the Google Cloud console in the same project as Firebase:
   [https://console.cloud.google.com](https://console.cloud.google.com)
2. Project picker (top bar) → **cricky-cricket-analysis**.
3. Go to
   [reCAPTCHA / Fraud Defense](https://console.cloud.google.com/security/recaptcha)
   (search “reCAPTCHA” if the menu moved).
4. If asked, **Enable** the reCAPTCHA Enterprise API. Wait until it finishes.
5. **Create key**:
   - Display name: `Cricky web`
   - Application type: **Web**
   - Keep **domain verification on** (do not disable it).
   - Add domains:
     - `cricky-cricket-analysis.web.app`
     - `cricky-cricket-analysis.firebaseapp.com`
   - Do **not** add `localhost` to this production key.
6. Create the key. Copy the **site key** (a long string starting with `6L`).
   That is `EXPO_PUBLIC_RECAPTCHA_SITE_KEY`, not a secret API key.

### B. Register it in Firebase App Check

1. Open
   [Firebase → App Check](https://console.firebase.google.com/project/cricky-cricket-analysis/appcheck)
2. **Apps** tab → your **Web** app → **Register**.
3. Provider: **reCAPTCHA Enterprise**.
4. Paste the site key from step A.
5. Save.

### C. Do not enforce

On the **APIs** tab you will see Realtime Database, Authentication, etc.

- Leave every row **Unenforced**.
- Enforcement would block the live v1 site and any client without a token.

### D. Put the key in `.env.local`

```
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=6L-your-site-key
```

### Local web (`localhost`)

The production reCAPTCHA key will not work on `localhost`. For emulator
development you do not need App Check (`npm run web:emulator` skips it).

If you later test the **production** Firebase project from localhost, create a
**debug token** in App Check → **Manage debug tokens**, then:

```
EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN=the-debug-token
```

---

## 3. What you should see

| File / console            | Expected                                     |
| ------------------------- | -------------------------------------------- |
| `.env.local`              | DSN and/or site key filled in                |
| GitHub                    | No new secrets (these values are public-ish) |
| Firebase App Check → APIs | All **Unenforced**                           |
| Live site                 | Unchanged (still v1)                         |
