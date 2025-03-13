import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

export { auth };  // Re-export auth

// firebase database service
export const createUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    return error;
  }
}

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    return error;
  }
}

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    return error;
  }
}

export const addUsername = async (username) => {
  try {
    await updateProfile(auth.currentUser, {
      displayName: username
    });
  } catch (error) {
    return error;
  }
}

const authService = {
  createUser,
  loginUser,
  logoutUser,
  addUsername,
  auth
};

export default authService;