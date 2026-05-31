import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from '@firebase/auth';

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey ?? '',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain ?? '',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId ?? '',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket ?? '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId ?? '',
  appId: Constants.expoConfig?.extra?.firebaseAppId ?? '',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = (() => {
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: (FirebaseAuth as any).getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh can re-run this module after Auth was already initialized.
    return FirebaseAuth.getAuth(app);
  }
})();

const db = getFirestore(app);

export { app, auth, db };
