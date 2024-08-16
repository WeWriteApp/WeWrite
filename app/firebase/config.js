// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const newConfig =  {
  apiKey: process.env.API_KEY,
  authDomain: process.env.DOMAIN,
  databaseURL: process.env.DB_URL,
  projectId: process.env.PID,
  storageBucket: process.env.BUCKET,
  messagingSenderId: process.env.MSNGR_ID,
  appId: process.env.APP_ID,
};


// Initialize Firebase
export const app = initializeApp(newConfig);
// module.exports = { app: process.env.initializeApp(newConfig) };

export default app; 
