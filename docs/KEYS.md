# App Check (owner)

Optional. The app runs without it. Do **not** turn on App Check enforcement in
Firebase until the v1 site is retired (Phase 7).

Sentry (also optional, skip for now): [`SENTRY.md`](SENTRY.md).

Copy `.env.example` to `.env.local` first:

```sh
copy .env.example .env.local
```

Restart `npm run web` after you save the file. `.env.local` is gitignored —
never commit it.

---

## Firebase App Check + reCAPTCHA (web)

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

| File / console            | Expected                                                |
| ------------------------- | ------------------------------------------------------- |
| `.env.local`              | Site key filled in (Sentry DSN only if you set that up) |
| GitHub                    | No new secrets (these values are public-ish)            |
| Firebase App Check → APIs | All **Unenforced**                                      |
| Live site                 | Unchanged (still v1)                                    |
