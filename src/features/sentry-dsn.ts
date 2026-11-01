/** Parsed client DSN. The public key is meant to be in the browser; do not put a secret auth token here. */
export interface SentryIngest {
  storeUrl: string;
  key: string;
}

/**
 * Reads `https://<key>@<host>/<projectId>` (with an optional `/ingest` host).
 * Returns null if the value is not a DSN, so a typo does not crash the app.
 */
export function parseSentryDsn(dsn: string): SentryIngest | null {
  try {
    const url = new URL(dsn.trim());
    const key = url.username;
    const project = url.pathname.replace(/^\//, '').split('/')[0];
    if (!key || !project || !/^\d+$/.test(project)) return null;
    return { storeUrl: `${url.protocol}//${url.host}/api/${project}/store/`, key };
  } catch {
    return null;
  }
}
