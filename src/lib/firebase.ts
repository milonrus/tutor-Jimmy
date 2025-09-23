import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6EvjCY-vxPqmP4t4M2PDUwEAVLRiZ2FQ",
  authDomain: "jimmytutor-6af38.firebaseapp.com",
  projectId: "jimmytutor-6af38",
  storageBucket: "jimmytutor-6af38.firebasestorage.app",
  messagingSenderId: "46022869592",
  appId: "1:46022869592:web:53267593a4ff5eb950c02d",
  measurementId: "G-TFQLY4S6VP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;