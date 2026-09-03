import { useEffect } from "react";

const SCRIPT_ID = "quantronsoft-chatbot-widget";
const SCRIPT_SRC = "https://www.quantronsoft.com/chatbot-widget.js?v=7";
const COMPANY_ID = "cf463f5e-024f-43b7-a4a7-fa9aa4d2dbd0";
const API_KEY = "7fbca4c88392bc52f129433e51731f995452e97e3dc77593";

/** Bot name, color, and welcome message come from the widget token / dashboard. */
const WIDGET_TOKEN =
  "eyJ2IjoxLCJleHAiOjE4MTk5OTA2OTk1ODYsImNvbXBhbnkiOnsiaWQiOiJjZjQ2M2Y1ZS0wMjRmLTQzYjctYTRhNy1mYTlhYTRkMmRiZDAiLCJuYW1lIjoiQXBuYSBJbnRlcm4iLCJhcGlfa2V5IjoiN2ZiY2E0Yzg4MzkyYmM1MmYxMjk0MzNlNTE3MzFmOTk1NDUyZTk3ZTNkYzc3NTkzIiwiYm90X25hbWUiOiJBcG5hIEludGVybiBBc3Npc3RhbnQgbmV3IGhlbGxvIiwid2VsY29tZV9tZXNzYWdlIjoiSGkhIEhvdyBjYW4gSSBoZWxwIHlvdSB0b2RheT8iLCJwcmltYXJ5X2NvbG9yIjoiIzdhZjAwNSIsImNvbXBhbnlfaW5mbyI6IkFwbmEgSW50ZXJuXG5DRU8gRW1haWw6IGV6eWludGVybi5pbkBnbWFpbC5jb20iLCJ3ZWJzaXRlX3VybCI6IiIsImdvb2dsZV9zZWFyY2hfZW5hYmxlZCI6dHJ1ZSwiY2VvX2VtYWlsIjoiZXp5aW50ZXJuLmluQGdtYWlsLmNvbSIsImtub3dsZWRnZSI6W10sInJ1bGVzIjpbeyJydWxlX3RleHQiOiJBbHdheXMgYmUgcG9saXRlIGFuZCBwcm9mZXNzaW9uYWwifSx7InJ1bGVfdGV4dCI6Ik5ldmVyIHNoYXJlIGNvbmZpZGVudGlhbCBpbmZvcm1hdGlvbiJ9XSwidXBkYXRlZF9hdCI6IjIwMjYtMDktMDNUMTY6NTg6MTkuNTg2WiJ9fQ.qKG4XJMd394sLYDpNjYQ0osU2F7--pitkICwLssnmmI";

/** QuantronSoft chat widget — load once per mount (home page). */
export function QuantronChatbot() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-company-id", COMPANY_ID);
    script.setAttribute("data-api-key", API_KEY);
    script.setAttribute("data-widget-token", WIDGET_TOKEN);
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.querySelector("[data-quantron-chatbot]")?.remove();
      document.getElementById("quantron-chatbot-root")?.remove();
    };
  }, []);

  return null;
}
