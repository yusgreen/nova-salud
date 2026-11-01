import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import { PreferenciasProvider } from "./context/PreferenciasContext";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <PreferenciasProvider>
        <ToastProvider>
          <ConfigProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ConfigProvider>
        </ToastProvider>
      </PreferenciasProvider>
    </ThemeProvider>
  </React.StrictMode>
);