import { matchPathFromHash } from '../share';

describe('matchPathFromHash', () => {
  it('maps a v1 share hash to the Expo path', () => {
    expect(matchPathFromHash('#match=-OmfXyHFYX11YWaDmxEL')).toBe('/match/-OmfXyHFYX11YWaDmxEL');
    expect(matchPathFromHash('#match=abc&x=1')).toBe('/match/abc');
  });

  it('ignores other hashes', () => {
    expect(matchPathFromHash('')).toBeNull();
    expect(matchPathFromHash('#tournaments')).toBeNull();
  });
});
