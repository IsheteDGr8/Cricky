import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { authPersistence } from './auth-persistence';
import { EMULATOR_PROJECT_ID, emulatorHost, firebaseConfig } from './config';

export interface Backend {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

let backend: Backend | null = null;

/** The app's single Firebase connection, created on first use. */
export function getBackend(): Backend {
  if (backend) return backend;

  const host = emulatorHost();
  const options = host
    ? {
        ...firebaseConfig,
        projectId: EMULATOR_PROJECT_ID,
        databaseURL: `https://${EMULATOR_PROJECT_ID}-default-rtdb.firebaseio.com`,
      }
    : firebaseConfig;

  const app = getApps().length ? getApp() : initializeApp(options);
  const auth = initAuth(app);
  const db = getDatabase(app);

  if (host) {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, host, 9000);
  }

  backend = { app, auth, db };
  return backend;
}

function initAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, { persistence: authPersistence });
  } catch {
    // Fast refresh re-runs this module after auth was already initialized.
    return getAuth(app);
  }
}
