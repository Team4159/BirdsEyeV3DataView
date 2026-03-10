import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

export function logOut(){
    const auth = getAuth();
    signOut(auth).then(() => {
    // Sign-out successful.
    console.log("User signed out");
    }).catch((error) => {
    // An error happened.
    console.error("Sign out error", error);
    });
}

export async function logInWithGoogle(){
    const provider = new GoogleAuthProvider();

    const auth = getAuth();
    auth.languageCode = 'it';

    try {
    await signInWithPopup(auth, provider)
    .catch((error) => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error(errorCode);
        console.error(errorMessage);
    });
    return "";
  } catch (error: any) {
    console.error(error.code);
    console.error(error.message);
    return error.message; // return error to UI
  }
}