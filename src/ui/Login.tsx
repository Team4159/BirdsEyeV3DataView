import { useState } from "react";
import { logInWithGoogle } from "../firebase/auth";

type LoginProps = {
  onChange: () => void;
};

export const Login: React.FC<LoginProps> = ({ onChange }) => {
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <div>
        <button
            //TODO implement login behavior
            onClick={async () => {
                console.log("login attempted")
                let loginStatus = await logInWithGoogle();
                console.log(loginStatus);
                if(loginStatus === ""){
                    onChange();
                    console.log("loginstatus good");
                }
                else{
                    console.error("sign in error");
                    console.error(loginStatus);
                    setErrorMessage(loginStatus);
                }
                //logInWithGoogle();
            }}
            >
            Log In With Google
        </button>
        <h3
            className = "authError">
            {errorMessage}
        </h3>
    </div>
  );
};