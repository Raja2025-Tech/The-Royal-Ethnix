// Picks the storage backend. With Firebase settings in .env the app uses Firebase (shared data,
// real logins). Without them it runs in demo mode with data kept in this browser only.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const usingFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const backend = usingFirebase
  ? (await import('./firebase')).createFirebaseBackend(firebaseConfig)
  : (await import('./local')).createLocalBackend();
