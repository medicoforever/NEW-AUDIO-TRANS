// 1. SET UP FIREBASE: Go to https://console.firebase.google.com/
// 2. Create a new project.
// 3. Go to Project Settings -> General tab.
// 4. Under "Your apps", click the web icon (</>) to register a new web app.
// 5. After registering, you'll see a firebaseConfig object. Copy its contents and paste them below.
// 6. SET UP AUTHENTICATION: In the Firebase console, go to Build -> Authentication -> Sign-in method tab.
// 7. Enable the "Google" provider.
// 8. SET UP FIRESTORE: In the Firebase console, go to Build -> Firestore Database -> Create database.
// 9. Start in "test mode" for now. This will allow your app to read and write data.
//    For production, you should set up proper security rules.

export const firebaseConfig = {
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsvaphTIz261oTCBLE9pd7sc6q4WxavCs",
  authDomain: "lkmkbgndkb.firebaseapp.com",
  projectId: "lkmkbgndkb",
  storageBucket: "lkmkbgndkb.firebasestorage.app",
  messagingSenderId: "1087976758964",
  appId: "1:1087976758964:web:fa742ebbd4063bdd3f41e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
