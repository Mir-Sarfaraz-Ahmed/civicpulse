import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBPAd1cu5sJBJf0R9Kx8ZOh6uXWufurmeY",
  authDomain: "stellar-inscriber-lxctm.firebaseapp.com",
  projectId: "stellar-inscriber-lxctm",
  storageBucket: "stellar-inscriber-lxctm.firebasestorage.app",
  messagingSenderId: "894684064199",
  appId: "1:894684064199:web:df35ffb388205719f451e2"
};

const DATABASE_ID = "ai-studio-civicpulseai-57c1ef15-820c-4362-b0cb-19f295fe0d6c";

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore with dedicated Database ID
export const db = getFirestore(app, DATABASE_ID);
