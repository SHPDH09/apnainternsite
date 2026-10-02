/**
 * Official WhatsApp Cloud API provider abstraction.
 * Never uses unofficial session / browser automation.
 */

export type SendTextInput = {
  to: string;
  body: string;
};

export type SendTemplateInput = {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
};

export class WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
    this.apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  private baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  async sendText(input: SendTextInput): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: "WhatsApp Cloud API is not configured (demo mode)" };
    }
    const res = await fetch(`${this.baseUrl()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to.replace(/\D/g, ""),
        type: "text",
        text: { body: input.body },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: json.error?.message || `WhatsApp API error (${res.status})` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  }

  async sendTemplate(input: SendTemplateInput): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: "WhatsApp Cloud API is not configured (demo mode)" };
    }
    const res = await fetch(`${this.baseUrl()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode || "en" },
          components: input.components || [],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: json.error?.message || `WhatsApp API error (${res.status})` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  }

  verifyWebhookToken(token: string): boolean {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
    return Boolean(expected && token === expected);
  }

  async processWebhookPayload(payload: unknown): Promise<{ processed: boolean }> {
    // Idempotent processing hook — persist via wa_crm_webhook_events in production DB layer.
    void payload;
    return { processed: true };
  }
}

export const whatsAppProvider = new WhatsAppProvider();
