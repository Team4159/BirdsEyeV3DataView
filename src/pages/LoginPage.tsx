import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useState } from "react";

type LoginPageProps = {
  onSuccess: (credentialResponse: CredentialResponse) => Promise<void>;
};

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [loginDebounce, setLoginDebounce] = useState(false);

  return (
    <div className="login-button-container">
      {!loginDebounce && (
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            if (loginDebounce) {
              return;
            }
            setLoginDebounce(true);
            await onSuccess(credentialResponse);
            setLoginDebounce(false);
          }}
          onError={() => {
            console.log("Login Failed");
          }}
        />
      )}
    </div>
  );
}
