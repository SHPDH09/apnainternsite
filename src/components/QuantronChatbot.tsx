import { useEffect } from "react";

const SCRIPT_ID = "quantronsoft-chatbot-widget";
const SCRIPT_SRC = "https://www.quantronsoft.com/chatbot-widget.js?v=3";

/** Bot name, color, and welcome message come from the widget token / dashboard. */
const WIDGET_TOKEN =
  "eyJ2IjoxLCJleHAiOjE4MTk5MDEwMzU3MDQsImNvbXBhbnkiOnsiaWQiOiJjZjQ2M2Y1ZS0wMjRmLTQzYjctYTRhNy1mYTlhYTRkMmRiZDAiLCJuYW1lIjoiQXBuYSBJbnRlcm4iLCJhcGlfa2V5IjoibG9jYWxfanZjc2h0ZTQ3ZiIsImJvdF9uYW1lIjoiQXBuYSBJbnRlcm4gQXNzaXN0YW50Iiwid2VsY29tZV9tZXNzYWdlIjoiSGkhIEhvdyBjYW4gSSBoZWxwIHlvdSB0b2RheT8iLCJwcmltYXJ5X2NvbG9yIjoiIzYzNjZmMSIsImNvbXBhbnlfaW5mbyI6IkFwbmEgSW50ZXJuXG5DRU8gRW1haWw6IGV6eWludGVybi5pbkBnbWFpbC5jb20iLCJ3ZWJzaXRlX3VybCI6IiIsImdvb2dsZV9zZWFyY2hfZW5hYmxlZCI6dHJ1ZSwiY2VvX2VtYWlsIjoiZXp5aW50ZXJuLmluQGdtYWlsLmNvbSIsImtub3dsZWRnZSI6W10sInJ1bGVzIjpbeyJydWxlX3RleHQiOiJBbHdheXMgYmUgcG9saXRlIGFuZCBwcm9mZXNzaW9uYWwifSx7InJ1bGVfdGV4dCI6Ik5ldmVyIHNoYXJlIGNvbmZpZGVudGlhbCBpbmZvcm1hdGlvbiJ9XSwidXBkYXRlZF9hdCI6IjIwMjYtMDktMDJUMTY6MDM6NTUuNzA0WiJ9fQ.I9D3kp9QCwh7AuRdZqMGCXHfA9VeOJRmer_VMLx8LZo";

/** QuantronSoft chat widget — load once per mount (home page). */
export function QuantronChatbot() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-api-key", "local_jvcshte47f");
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
