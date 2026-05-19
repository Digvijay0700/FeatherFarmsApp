import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDY70_Aa698FE9KzzcmkjyFn-CHGratfxg",
  authDomain: "featherframs.firebaseapp.com",
  projectId: "featherframs",
  storageBucket: "featherframs.firebasestorage.app",
  messagingSenderId: "24277638021",
  appId: "1:24277638021:web:c558ecb719adb6d0c1c2ec",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export default app;