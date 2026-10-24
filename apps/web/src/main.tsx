import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 2 * 60e3, gcTime: 30 * 60e3, retry: 2, refetchOnWindowFocus: false } } });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ErrorBoundary>
        <BrowserRouter><App /></BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
