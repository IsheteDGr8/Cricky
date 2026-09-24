# Security review (MASVS + ASVS Level 1)

Checked against [OWASP MASVS](https://mas.owasp.org/MASVS/) (mobile) and
[ASVS Level 1](https://owasp.org/www-project-application-security-verification-standard/) (web)
for the new Expo app. The live v1 site is covered only where noted; it is retired at cutover.

| ID                 | Requirement                                 | Status  | Notes                                                                                                        |
| ------------------ | ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| MASVS-STORAGE-1    | No sensitive data in logs or backups in git | Pass    | `backups/` gitignored; no emails stored                                                                      |
| MASVS-STORAGE-2    | Secrets not in the client                   | Pass    | Firebase web config is public by design; rules + App Check are the boundary                                  |
| MASVS-CRYPTO-1     | Secure random for scorer codes              | Pass    | `expo-crypto` / Web Crypto; 10 chars from a 32-symbol alphabet                                               |
| MASVS-AUTH-1       | Auth for privileged actions                 | Pass    | Admins: Google (Apple later). Scorers: anonymous + per-match code. Viewers: none                             |
| MASVS-AUTH-2       | Session bound to the device                 | Pass    | Auth persistence is local; roles live on the server                                                          |
| MASVS-NETWORK-1    | TLS only                                    | Pass    | Firebase and Hosting are HTTPS; HSTS on Hosting                                                              |
| MASVS-NETWORK-2    | App Check on API calls                      | Partial | Wired when `EXPO_PUBLIC_RECAPTCHA_SITE_KEY` is set. **Do not enforce** on the live database until v1 is gone |
| MASVS-PLATFORM-1   | Platform isolation                          | Pass    | Expo app; no WebView wrapper (Apple 4.2)                                                                     |
| MASVS-CODE-1       | No debug backdoors in release               | Pass    | Emulator host is opt-in via env; App Check debug token is opt-in                                             |
| MASVS-RESILIENCE-1 | Tamper-evident scoring                      | Pass    | Append-only events; undo is last-event only; completed matches lock                                          |
| ASVS V1            | Architecture                                | Pass    | Layer boundaries (ESLint); threat model; default-deny rules                                                  |
| ASVS V2            | Authentication                              | Pass    | Email/password sign-up disabled; PIN account retired at cutover                                              |
| ASVS V3            | Session                                     | Pass    | Firebase Auth tokens; scorer access revoked by rotating the code                                             |
| ASVS V4            | Access control                              | Pass    | Rules tests for every role; `/roles` owner-only                                                              |
| ASVS V5            | Validation                                  | Pass    | Rules `.validate` + zod on read + scoring engine                                                             |
| ASVS V13           | API                                         | Pass    | No open write; scorer codes not client-readable                                                              |
| ASVS V14           | Config                                      | Partial | CSP is **report-only** on Hosting until the Expo web export replaces `legacy/`                               |

## Residual (accepted until cutover)

- v1 admin PIN is 4 digits. Writes are limited to that one Auth UID.
- App Check is not enforced on production RTDB (v1 clients have no token).
- Scorer codes are plaintext to admins (Realtime Database rules cannot hash).

## Owner actions still required

1. Create an App Check app + reCAPTCHA Enterprise site key; set `EXPO_PUBLIC_RECAPTCHA_SITE_KEY`. Enforce App Check on Auth/RTDB only after cutover.
2. Create a free Sentry project; set `EXPO_PUBLIC_SENTRY_DSN`.
3. Keep the $1 Cloud Billing budget alert.
