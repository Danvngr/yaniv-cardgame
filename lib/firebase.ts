import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth, type Auth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey ?? '',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain ?? '',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId ?? '',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket ?? '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId ?? '',
  appId: Constants.expoConfig?.extra?.firebaseAppId ?? '',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth: Auth;
if (getApps().length === 1) {
  // App was just initialized - use initializeAuth with persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  // App already exists - get existing auth
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
