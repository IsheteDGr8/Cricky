import { browserLocalPersistence, type Persistence } from 'firebase/auth';

/** Web: keep the session in localStorage so scorers stay signed in across reloads. */
export const authPersistence: Persistence = browserLocalPersistence;
