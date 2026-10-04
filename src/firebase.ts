import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDRcjymDaRMkhQoUOw7IwEaP6HQCV5YmXs",
  authDomain: "danji-9b4ff.firebaseapp.com",
  projectId: "danji-9b4ff",
  storageBucket: "danji-9b4ff.firebasestorage.app",
  messagingSenderId: "373969273371",
  appId: "1:373969273371:web:44b4b38f3e9be38fb7eebe",
  measurementId: "G-KG5GNLN89F",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west2");
