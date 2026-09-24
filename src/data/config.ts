import type { FirebaseOptions } from 'firebase/app';

/**
 * The Firebase web config is public by design: it only identifies the project.
 * Access is enforced by firebase/database.rules.json (and App Check, Phase 5).
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyAzIFrKBsY2iwHRdFAPzE4NrincGKv8iyE',
  authDomain: 'cricky-cricket-analysis.firebaseapp.com',
  databaseURL: 'https://cricky-cricket-analysis-default-rtdb.firebaseio.com',
  projectId: 'cricky-cricket-analysis',
  storageBucket: 'cricky-cricket-analysis.firebasestorage.app',
  messagingSenderId: '42341049471',
  appId: '1:42341049471:web:f95eca1eddbf492b1d0b4a',
};

/**
 * Set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST (e.g. "127.0.0.1", or your computer's LAN IP when
 * testing on a phone) to use the local emulator started by `npm run emulators`.
 */
export function emulatorHost(): string | null {
  return process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || null;
}

/** The emulator only serves "demo-" projects, so local data never touches production. */
export const EMULATOR_PROJECT_ID = 'demo-cricky';
