import { parseSentryDsn } from '../sentry-dsn';

describe('parseSentryDsn', () => {
  it('reads a normal client DSN', () => {
    expect(parseSentryDsn('https://abc123@o99.ingest.us.sentry.io/123456')).toEqual({
      storeUrl: 'https://o99.ingest.us.sentry.io/api/123456/store/',
      key: 'abc123',
    });
  });

  it('ignores blanks and junk so a typo cannot crash startup', () => {
    expect(parseSentryDsn('')).toBeNull();
    expect(parseSentryDsn('not-a-url')).toBeNull();
    expect(parseSentryDsn('https://sentry.io/no-key')).toBeNull();
  });
});
