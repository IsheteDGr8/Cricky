import { generateScorerCode, normalizeScorerCode } from '../codes';
import { DataError, isPermissionDenied, toWriteError } from '../errors';
import { SCORER_CODE_ALPHABET, ScorerCodeSchema } from '../schemas';

const bytes =
  (...values: number[]) =>
  () =>
    Uint8Array.from(values);

describe('generateScorerCode', () => {
  it('maps each byte onto the 32-symbol alphabet', () => {
    expect(generateScorerCode(bytes(0, 1, 2, 3, 4, 5, 6, 7, 8, 31))).toBe('ABCDEFGHJ9');
    expect(generateScorerCode(bytes(32, 33, 64, 65, 96, 97, 128, 129, 224, 255))).toBe(
      'ABABABABA9',
    );
  });

  it('always produces a code the database rules accept', () => {
    for (let i = 0; i < 50; i++) {
      const random = () => Uint8Array.from({ length: 10 }, () => Math.floor(Math.random() * 256));
      expect(ScorerCodeSchema.safeParse(generateScorerCode(random)).success).toBe(true);
    }
  });

  it('never uses look-alike characters', () => {
    expect(SCORER_CODE_ALPHABET).not.toMatch(/[01IO]/);
    expect(SCORER_CODE_ALPHABET).toHaveLength(32);
  });

  it('refuses to run short of randomness', () => {
    expect(() => generateScorerCode(bytes(1, 2, 3))).toThrow('Not enough random bytes');
  });
});

describe('normalizeScorerCode', () => {
  it('accepts lowercase, spaces and dashes', () => {
    expect(normalizeScorerCode(' k7pq-2mzx ra ')).toBe('K7PQ2MZXRA');
  });
});

describe('errors', () => {
  it('recognises Firebase permission errors', () => {
    expect(isPermissionDenied({ code: 'PERMISSION_DENIED' })).toBe(true);
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied(new Error('PERMISSION_DENIED: Permission denied'))).toBe(true);
    expect(isPermissionDenied(new Error('network down'))).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
  });

  it('turns rule rejections into DataErrors and passes other errors through', () => {
    const denied = toWriteError({ code: 'PERMISSION_DENIED' }, 'nope');
    expect(denied).toBeInstanceOf(DataError);
    expect((denied as DataError).code).toBe('permission_denied');
    const other = new Error('offline');
    expect(toWriteError(other, 'nope')).toBe(other);
  });
});
