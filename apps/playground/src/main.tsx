import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const nativeAvailable = typeof globalThis.Temporal !== "undefined";
const engine = new URL(location.href).searchParams.get("temporal") === "native" && nativeAvailable ? "native" : "polyfill";
if (engine === "polyfill") await import("temporal-polyfill/global");
const { App } = await import("./App");
createRoot(document.getElementById("root")!).render(<StrictMode><App engine={engine} nativeAvailable={nativeAvailable} /></StrictMode>);