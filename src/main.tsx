import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId="345042135934-lcavnsrivopepdoekiic4oj99isqnp62.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
)
