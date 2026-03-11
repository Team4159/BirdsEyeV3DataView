import type { CredentialResponse } from "@react-oauth/google";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";

export function logOut(){
    const auth = getAuth();
    signOut(auth).then(() => {
    // Sign-out successful.
    console.log("User signed out");
    }).catch((error: any) => {
    // An error happened.
    console.error("Sign out error", error);
    });
}

export async function logInWithGoogle(tokenResponse: CredentialResponse) {
  const auth = getAuth();
  
  if (!tokenResponse.credential) {
    throw new Error("Google login failed: no credential returned");
  }

  const credential = GoogleAuthProvider.credential(tokenResponse.credential);

  try {
    const userCredential = await signInWithCredential(auth, credential);
    console.log("Firebase signed in user:", userCredential.user);
    return "";
  } catch (error: any) {
    console.error("Firebase sign-in error:", error.message);
    return error.message;
  }
}