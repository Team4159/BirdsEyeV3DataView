import { createRoot } from "react-dom/client";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";

// biome-ignore lint/style/noNonNullAssertion: root always present
createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId="345042135934-lcavnsrivopepdoekiic4oj99isqnp62.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>,
);
