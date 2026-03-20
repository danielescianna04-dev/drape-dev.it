import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCcqg1ys35IXuUhWfv369TJlL4_EXpPWvg",
  authDomain: "drapev2.firebaseapp.com",
  projectId: "drapev2",
  storageBucket: "drapev2.firebasestorage.app",
  messagingSenderId: "76009555388",
  appId: "1:76009555388:web:09793732ba27903dccd7b9",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
