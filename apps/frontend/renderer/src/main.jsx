import "../input.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./ui/ToastProvider.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
    <ToastProvider>
        <App />
    </ToastProvider>
);
