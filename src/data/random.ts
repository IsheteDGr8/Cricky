import { getRandomBytes } from 'expo-crypto';
import type { RandomBytes } from './codes';

/** Cryptographically secure bytes on every platform. */
export const secureRandomBytes: RandomBytes = (length) => getRandomBytes(length);
