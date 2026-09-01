import { useEffect } from "react";

const SCRIPT_ID = "quantronsoft-chatbot-widget";
const SCRIPT_SRC = "https://www.quantronsoft.com/chatbot-widget.js";

/** QuantronSoft chat widget — load once per mount (home page). */
export function QuantronChatbot() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-api-key", "local_45z75gzry7s");
    script.setAttribute("data-api-url", "https://www.quantronsoft.com/api/chatbot-widget-chat");
    script.setAttribute("data-bot-name", "16354 Assistant");
    script.setAttribute("data-color", "#6366f1");
    script.setAttribute("data-welcome", "Hi! How can I help you today?");
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.querySelector("[data-quantron-chatbot]")?.remove();
      document.getElementById("quantron-chatbot-root")?.remove();
    };
  }, []);

  return null;
}
