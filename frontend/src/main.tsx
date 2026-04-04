import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./main.css";

/** Cache ESPN logo responses in the browser after first load (see public/espn-assets-sw.js). */
function registerEspnLogoCacheWorker() {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker
    .register("/espn-assets-sw.js", { scope: "/" })
    .catch(() => {
      /* non-HTTPS or blocked — app works without offline logo cache */
    });
}

registerEspnLogoCacheWorker();

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
