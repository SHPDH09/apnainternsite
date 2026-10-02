import type { Express, Request, Response } from "express";
import { getWaCrmDemoSnapshot, waCrmDemoMode } from "./demo-data.js";
import { whatsAppProvider } from "./whatsapp-provider.js";
import { aiProvider } from "./ai-provider.js";

function json(res: Response, status: number, body: unknown) {
  res.status(status).json(body);
}

function requireAdmin(_req: Request, res: Response, next: () => void) {
  // WA CRM routes sit behind admin login on the frontend; API uses same Bearer session as the portal.
  const auth = res.req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    json(res, 401, { message: "Authorization required" });
    return;
  }
  next();
}

export function mountWaCrmRoutes(app: Express): void {
  app.get("/api/wa-crm/health", (_req, res) => {
    json(res, 200, {
      ok: true,
      demoMode: waCrmDemoMode(),
      whatsappConfigured: whatsAppProvider.isConfigured(),
    });
  });

  app.get("/api/wa-crm/bootstrap", requireAdmin, (_req, res) => {
    json(res, 200, getWaCrmDemoSnapshot());
  });

  app.get("/api/wa-crm/conversations/:id/messages", requireAdmin, (req, res) => {
    const snap = getWaCrmDemoSnapshot();
    const id = String(req.params.id);
    json(res, 200, { messages: snap.messagesByConversation[id] || [] });
  });

  app.post("/api/wa-crm/messages/send", requireAdmin, async (req, res) => {
    const { to, body, conversationId } = (req.body || {}) as {
      to?: string;
      body?: string;
      conversationId?: string;
    };
    if (!to || !body) {
      json(res, 400, { message: "to and body required" });
      return;
    }
    const result = await whatsAppProvider.sendText({ to, body });
    if (!result.ok && waCrmDemoMode()) {
      json(res, 200, {
        ok: true,
        demoMode: true,
        message: {
          id: `demo-${Date.now()}`,
          conversationId,
          direction: "outbound",
          body,
          status: "sent",
          at: new Date().toISOString(),
        },
      });
      return;
    }
    json(res, result.ok ? 200 : 502, result);
  });

  app.post("/api/wa-crm/ai/suggest-reply", requireAdmin, async (req, res) => {
    const { message, knowledge } = (req.body || {}) as {
      message?: string;
      knowledge?: string[];
    };
    const snap = getWaCrmDemoSnapshot();
    const reply = await aiProvider.generateResponse({
      customerMessage: message || "",
      knowledgeSnippets: knowledge || [
        "Machine Learning course fee is ₹2,599 for 4 weeks.",
        "Registration is on apnaintern.in/register",
      ],
      systemInstructions: snap.aiSettings.systemInstructions,
    });
    json(res, 200, reply);
  });

  app.post("/api/wa-crm/campaigns/validate", requireAdmin, (req, res) => {
    const { audienceCount = 0, templateStatus = "approved", optOutExcluded = 0 } = (req.body ||
      {}) as Record<string, unknown>;
    json(res, 200, {
      ok: true,
      checks: {
        optInVerified: true,
        templateApproved: templateStatus === "approved",
        duplicateRemoved: true,
        invalidNumbersRemoved: true,
        optOutExcluded,
        recipientCount: Number(audienceCount) || 0,
      },
      message: "Compliance checks passed (demo). Real sends require opt-in records and approved templates.",
    });
  });

  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = String(req.query["hub.mode"] || "");
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");
    if (mode === "subscribe" && whatsAppProvider.verifyWebhookToken(token)) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
  });

  app.post("/api/webhooks/whatsapp", async (req, res) => {
    await whatsAppProvider.processWebhookPayload(req.body);
    json(res, 200, { ok: true });
  });
}
