# App Check and the $1 budget alert (owner)

Do **not** turn on App Check **Enforce**. The old PIN admin account is still
there. Enforcement would also break any client that has no token.

Copy `.env.example` to `.env.local` if you do not already have that file.
`.env.local` is gitignored — never commit it.

---

## 1. Firebase App Check + reCAPTCHA (website only)

Goal: the live site _can_ prove it is your app. Leave every API **Unenforced**.

### A. Create a Fraud Defense (reCAPTCHA) key

If you see **“reCAPTCHA Classic is deprecated, please use Google Cloud Fraud
Defense instead”**, that is only a warning. Do **not** create a Classic key.
Fraud Defense is the new name for reCAPTCHA Enterprise, which is what App Check
wants.

1. Open this link (already scoped to our project):
   [Fraud Defense / reCAPTCHA keys](https://console.cloud.google.com/security/recaptcha/create?project=cricky-cricket-analysis)
2. Top bar project picker must say **cricky-cricket-analysis**. If it does not,
   click it → **All** → search `cricky`.
3. If the page says **Enable API** or **Enable Fraud Defense**, click that and
   wait until it finishes. Then open the create-key link again.
4. Fill in **Create key**:
   - Display name: `Cricky web`
   - Application type: **Web** (not Android, not iOS)
   - **Disable domain verification**: leave this **off**
   - **Use checkbox challenge** / **Will you use challenges?**: leave **off**
     (App Check needs a score-based key; users must not see a puzzle)
   - Domains → **Add a domain**, twice:
     - `cricky-cricket-analysis.web.app`
     - `cricky-cricket-analysis.firebaseapp.com`
   - Do **not** add `localhost`
   - Do **not** mark it as a test key
5. Create it. Copy the **site key** (starts with `6L`). That is not a secret.

### B. Register it in Firebase App Check

1. Open
   [Firebase → App Check](https://console.firebase.google.com/project/cricky-cricket-analysis/appcheck)
2. **Apps** tab → the **Web** app named **Cricky** → **Register**.
3. Provider: **reCAPTCHA Enterprise**.
4. Paste the site key from step A. Save.

### C. Leave enforcement off

Open the **APIs** tab. Realtime Database, Authentication, etc. must stay
**Unenforced**. Do not click Enforce.

### D. Put the key in `.env.local`

```
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=6L-your-site-key
```

Tell the agent you pasted it so they can rebuild the live site. Until that
deploy, the live site will not send App Check tokens.

`localhost` / the emulator do not need this key (`npm run web:emulator` skips it).

iPhone App Attest comes later, after there is an iOS Firebase app and a TestFlight build.

---

## 2. $1 Firebase budget alert

This emails you if the project might start costing money. It does **not**
automatically shut the project off.

1. Open
   [https://console.cloud.google.com/billing?project=cricky-cricket-analysis](https://console.cloud.google.com/billing?project=cricky-cricket-analysis)
2. If it asks you to link a billing account, pick the one already attached
   (Firebase Spark/Blaze). You cannot create a budget with no billing account.
3. Left menu → **Budgets & alerts** → **Create budget**.
4. Fill it in like this:
   - Name: `Cricky $1`
   - Projects: **cricky-cricket-analysis** only
   - Time range: **Monthly**
   - Amount: **Specified amount** → `1` USD
5. **Set budget alerts**:
   - 50% of budget ($0.50)
   - 90%
   - 100%
   - Email: your Google account (default)
6. **Create**.

If Google says billing is not enabled, you are still on the free Spark plan
and there is no bill to watch. You can skip this until you switch to Blaze.
(App Check / some Google APIs may ask you to enable Blaze. Free-tier usage
usually stays $0; the $1 alert is the safety net.)

---

## What you should see when you are done

| Where                     | Expected                                   |
| ------------------------- | ------------------------------------------ |
| `.env.local`              | Both `EXPO_PUBLIC_…` lines filled in       |
| GitHub                    | No new secrets                             |
| Firebase App Check → APIs | Every row **Unenforced**                   |
| Cloud Billing → Budgets   | `Cricky $1` (or skipped if still on Spark) |
| Live site                 | Unchanged until the agent redeploys        |
