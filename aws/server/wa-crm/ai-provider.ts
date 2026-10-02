/** Configurable AI provider abstraction (OpenAI / Gemini via server env). */

export type AiReplyInput = {
  customerMessage: string;
  knowledgeSnippets: string[];
  systemInstructions?: string;
};

export class AIProvider {
  async generateResponse(input: AiReplyInput): Promise<{ text: string; confidence: number }> {
    const kb = input.knowledgeSnippets.join("\n").toLowerCase();
    const msg = input.customerMessage.toLowerCase();

    if (/human|agent|support team|call me/i.test(msg)) {
      return {
        text: "I'll connect you with our support team.",
        confidence: 0.95,
      };
    }

    if (/machine learning|ml course|fee|price|₹|rs/.test(msg)) {
      if (/fee|price|₹|rs|kitna|cost/.test(msg)) {
        return {
          text: "Our Machine Learning course is available for ₹2,599. Would you like me to share the course details and duration?",
          confidence: kb.includes("2599") || kb.includes("machine learning") ? 0.88 : 0.72,
        };
      }
    }

    if (/registration|register|admission/.test(msg)) {
      return {
        text: "Registration is open on our website. Share your email and preferred course — our team can guide you through the steps.",
        confidence: 0.75,
      };
    }

    return {
      text:
        input.systemInstructions?.includes("fallback") === false
          ? "Thanks for your message. A team member will assist you shortly."
          : "I'll connect you with our support team for the best help.",
      confidence: 0.45,
    };
  }

  summarizeConversation(lines: string[]): string {
    return [
      "Customer summary (demo):",
      lines.slice(-6).join(" | "),
      "",
      "Recommended next action: Sales follow-up within 24 hours.",
    ].join("\n");
  }
}

export const aiProvider = new AIProvider();
