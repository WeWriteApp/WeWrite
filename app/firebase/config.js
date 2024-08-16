// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
const {
    API_KEY,
    DOMAIN,
    DB_URL,
    PID,
    BUCKET,
    MSNGR_ID,
    APP_ID,
} =  process.env;
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const newConfig =  {
  apiKey: API_KEY,
  authDomain: DOMAIN,
  databaseURL: DB_URL,
  projectId: PID,
  storageBucket: BUCKET,
  messagingSenderId: MSNGR_ID,
  appId: APP_ID,
};


// Initialize Firebase
export const app = initializeApp(newConfig);
// module.exports = { app: initializeApp(newConfig) };
