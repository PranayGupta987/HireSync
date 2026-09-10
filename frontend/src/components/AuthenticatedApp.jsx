import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import App from "../App";
import { setTokenProvider } from "../lib/axios";

function AuthenticatedApp() {
  const { getToken, isLoaded } = useAuth();
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return undefined;

    setTokenProvider(getToken);
    setIsApiReady(true);

    return () => {
      setTokenProvider(null);
      setIsApiReady(false);
    };
  }, [getToken, isLoaded]);

  // This lets the API authenticate when it is served from a different origin
  // from the Vite app, where browser cookies cannot be shared.
  if (!isLoaded || !isApiReady) return null;

  return <App />;
}

export default AuthenticatedApp;
