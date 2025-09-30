import "../input.css";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./ui/ToastProvider.jsx";
import { attachGlobalErrorHandlers } from './lib/log/logger';

attachGlobalErrorHandlers();

const root = createRoot(document.getElementById("root"));
root.render(
    <ToastProvider>
        <App />
    </ToastProvider>
);
