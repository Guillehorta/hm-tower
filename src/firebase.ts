import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
export { firebaseConfig };

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Validation UI Test
async function testFirestoreConnection() {
  try {
    // Attempting a server fetch to verify config
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
    console.log("Firebase connection verified.");
  } catch (error: any) {
    if (error.message?.includes('offline')) {
      console.error("Firebase connection error: Client is offline or config is invalid.");
    }
  }
}

testFirestoreConnection();

export { 
  signInWithPopup, 
  onAuthStateChanged,
  onSnapshot,
  collection,
  query,
  where,
  doc,
  Timestamp
};
export type { FirebaseUser };
