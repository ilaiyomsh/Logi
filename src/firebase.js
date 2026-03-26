import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let DATA_REF = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    DATA_REF = ref(db, 'logistics');
  } catch (e) {
    console.warn('Firebase init failed:', e);
  }
}

export { isConfigured };

// Subscribe to realtime updates — returns unsubscribe function
export function subscribeToData(callback) {
  if (!DATA_REF) {
    callback(null);
    return () => {};
  }
  return onValue(DATA_REF, (snapshot) => {
    callback(snapshot.val());
  });
}

// Write full data object
export async function saveData(data) {
  if (!DATA_REF) return;
  await set(DATA_REF, data);
}
