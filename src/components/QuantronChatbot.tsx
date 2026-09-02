import { useEffect } from "react";

const SCRIPT_ID = "quantronsoft-chatbot-widget";
const SCRIPT_SRC = "https://www.quantronsoft.com/chatbot-widget.js";

const WIDGET_TOKEN =
  "eyJ2IjoxLCJleHAiOjE4MTk4ODk4MjMzMjQsImNvbXBhbnkiOnsiaWQiOiJsb2NhbC1xdWFudHJvbnNvZnQiLCJuYW1lIjoiUXVhbnRyb25Tb2Z0IiwiYXBpX2tleSI6ImxvY2FsX2RlbW9fa2RuYzM4MTM1MSIsImJvdF9uYW1lIjoiUXVhbnRyb25Cb3QiLCJ3ZWxjb21lX21lc3NhZ2UiOiJIaSEgSG93IGNhbiBJIGhlbHAgeW91IGxlYXJuIGFib3V0IFF1YW50cm9uIFNvZnQgc2VydmljZXM_IiwicHJpbWFyeV9jb2xvciI6IiM2MzY2ZjEiLCJjb21wYW55X2luZm8iOiJRdWFudHJvbiBTb2Z0IOKAlCBHbG9iYWwgU29mdHdhcmUgJiBBSSBTb2x1dGlvbnMgQ29tcGFueS4iLCJ3ZWJzaXRlX3VybCI6Imh0dHBzOi8vcXVhbnRyb25zb2Z0LmNvbSIsImdvb2dsZV9zZWFyY2hfZW5hYmxlZCI6dHJ1ZSwiY2VvX2VtYWlsIjoiYWRtaW5AcXVhbnRyb25zb2Z0LmNvbSIsImtub3dsZWRnZSI6W3siY2F0ZWdvcnkiOiJjZW9fcmV2aWV3IiwicXVlc3Rpb24iOiJreWEga3IgcmhlIGhvIiwiYW5zd2VyIjoibm8ifSx7ImNhdGVnb3J5IjoiY2VvX3JldmlldyIsInF1ZXN0aW9uIjoia2VzZSBobyIsImFuc3dlciI6ImJhZGh5YSJ9LHsiY2F0ZWdvcnkiOiJjZW9fcmV2aWV3IiwicXVlc3Rpb24iOiJoZWxsbyIsImFuc3dlciI6InNkIn0seyJjYXRlZ29yeSI6ImNlb19yZXZpZXciLCJxdWVzdGlvbiI6ImhpaSIsImFuc3dlciI6ImhpaSJ9XSwicnVsZXMiOlt7InJ1bGVfdGV4dCI6InBsZWFzZSBnaXZlcyB1cyJ9LHsicnVsZV90ZXh0IjoiQWx3YXlzIGJlIHBvbGl0ZSBhbmQgcHJvZmVzc2lvbmFsIn0seyJydWxlX3RleHQiOiJOZXZlciBzaGFyZSBjb25maWRlbnRpYWwgaW5mb3JtYXRpb24ifSx7InJ1bGVfdGV4dCI6IlJlcGx5IGluIHRoZSB1c2VyJ3MgbGFuZ3VhZ2Ugd2hlbiBwb3NzaWJsZSJ9XSwidXBkYXRlZF9hdCI6IjIwMjYtMDktMDJUMTI6NTc6MDMuMzI0WiJ9fQ.017nxuzHNPhLh7CPdBcFLCHITFFKjwK7A2p9Hkg4VCY";

/** QuantronSoft chat widget — load once per mount (home page). */
export function QuantronChatbot() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-api-key", "local_demo_kdnc381351");
    script.setAttribute("data-api-url", "https://www.quantronsoft.com/api/chatbot-widget-chat");
    script.setAttribute("data-widget-token", WIDGET_TOKEN);
    script.setAttribute("data-bot-name", "QuantronBot");
    script.setAttribute("data-color", "#6366f1");
    script.setAttribute(
      "data-welcome",
      "Hi! How can I help you learn about Quantron Soft services?",
    );
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.querySelector("[data-quantron-chatbot]")?.remove();
      document.getElementById("quantron-chatbot-root")?.remove();
    };
  }, []);

  return null;
}
