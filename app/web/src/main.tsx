import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { QueryProvider } from "./app/providers/QueryProvider";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <ErrorBoundary>
        <BrowserRouter><App /></BrowserRouter>
      </ErrorBoundary>
    </QueryProvider>
  </React.StrictMode>
);
