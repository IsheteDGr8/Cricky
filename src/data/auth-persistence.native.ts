import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';

// getReactNativePersistence only exists in the React Native build of firebase/auth,
// which Metro resolves; the published types describe the web build.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
};

/** iOS/Android: keep the session in AsyncStorage so scorers stay signed in across launches. */
export const authPersistence: FirebaseAuth.Persistence = getReactNativePersistence(AsyncStorage);
