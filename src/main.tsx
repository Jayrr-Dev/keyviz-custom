import { CatchingAppErrors } from "@/components/catchingAppErrors";
import { listeningRuntimeErrors } from "@/lib/listeningRuntimeErrors";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

listeningRuntimeErrors();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CatchingAppErrors>
      <App />
    </CatchingAppErrors>
  </React.StrictMode>,
);
