import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DevApp } from "./dev/DevApp.tsx";

/** Two modes on one static site: the survey at the root, developer mode at #/dev. */
function Root() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  // Supabase's magic link lands with access tokens in the hash; keep developer mode for those too.
  const dev = hash.startsWith("#/dev") || hash.includes("access_token=");
  return dev ? <DevApp /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
