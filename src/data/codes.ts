import { SCORER_CODE_ALPHABET, SCORER_CODE_LENGTH } from './schemas';

export type RandomBytes = (length: number) => Uint8Array;

/**
 * A random scorer code like "K7PQ2MZXRA". 32 symbols (no 0/O or 1/I) make 32^10 ≈ 10^15 codes,
 * and 256 is a multiple of 32, so taking each byte modulo 32 has no bias.
 */
export function generateScorerCode(randomBytes: RandomBytes): string {
  const bytes = randomBytes(SCORER_CODE_LENGTH);
  if (bytes.length < SCORER_CODE_LENGTH) throw new Error('Not enough random bytes');
  let code = '';
  for (let i = 0; i < SCORER_CODE_LENGTH; i++) {
    code += SCORER_CODE_ALPHABET[(bytes[i] as number) % SCORER_CODE_ALPHABET.length];
  }
  return code;
}

/** Accepts codes typed with spaces, dashes or lowercase. */
export function normalizeScorerCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}
