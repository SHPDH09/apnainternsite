/** Demo dataset for WA CRM when Cloud API credentials are not configured. */

export type WaAgent = {
  id: string;
  fullName: string;
  email: string;
  status: "online" | "away" | "offline" | "busy";
  team: string;
  chats: number;
  resolved: number;
  pending: number;
  avgResponseMin: number;
};

export type WaContact = {
  id: string;
  fullName: string;
  whatsappNumber: string;
  email?: string;
  company?: string;
  location?: string;
  source: string;
  tags: string[];
  leadStatus: string;
  assignedAgentId?: string;
  optIn: boolean;
  optOut: boolean;
  lastMessage?: string;
  lastContactedAt?: string;
};

export type WaMessage = {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound" | "internal_note";
  body: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  at: string;
  isAi?: boolean;
};

export type WaConversation = {
  id: string;
  contactId: string;
  status: "open" | "pending" | "resolved";
  assignedAgentId?: string;
  isAi: boolean;
  unread: number;
  lastMessage: string;
  lastAt: string;
};

export type WaLead = {
  id: string;
  title: string;
  contactId: string;
  stage: string;
  source: string;
  assignedAgentId?: string;
};

export type WaCampaign = {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  optOuts: number;
};

export type WaTemplate = {
  id: string;
  name: string;
  category: "marketing" | "utility" | "authentication";
  language: string;
  body: string;
  status: "draft" | "pending" | "approved" | "rejected";
};

const agents: WaAgent[] = [
  { id: "ag1", fullName: "Amit Sharma", email: "amit@demo.local", status: "online", team: "Sales", chats: 24, resolved: 18, pending: 6, avgResponseMin: 4.2 },
  { id: "ag2", fullName: "Priya Singh", email: "priya@demo.local", status: "busy", team: "Education", chats: 19, resolved: 15, pending: 4, avgResponseMin: 3.1 },
  { id: "ag3", fullName: "Rahul Verma", email: "rahul@demo.local", status: "away", team: "Support", chats: 12, resolved: 10, pending: 2, avgResponseMin: 6.5 },
  { id: "ag4", fullName: "Sneha Patel", email: "sneha@demo.local", status: "online", team: "Sales", chats: 21, resolved: 17, pending: 4, avgResponseMin: 5.0 },
  { id: "ag5", fullName: "Vikash Kumar", email: "vikash@demo.local", status: "offline", team: "Technical", chats: 8, resolved: 7, pending: 1, avgResponseMin: 8.2 },
];

const contacts: WaContact[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `c${i + 1}`,
  fullName: ["Rahul Kumar", "Anita Devi", "Mohit Yadav", "Kavya Mishra", "Arjun Singh"][i % 5] + ` ${i + 1}`,
  whatsappNumber: `9198765${String(43210 + i).slice(-5)}`,
  email: i % 3 === 0 ? `student${i + 1}@example.com` : undefined,
  company: i % 4 === 0 ? "Local College" : undefined,
  location: ["Patna", "Delhi", "Mumbai", "Bihar", "Kolkata"][i % 5],
  source: ["Website", "WhatsApp", "Facebook", "Instagram", "Referral", "CSV", "Manual"][i % 7],
  tags: i % 2 === 0 ? ["Student", "Hot Lead"] : ["Student"],
  leadStatus: ["new", "contacted", "qualified", "interested", "converted"][i % 5],
  assignedAgentId: agents[i % agents.length].id,
  optIn: i % 5 !== 0,
  optOut: i % 17 === 0,
  lastMessage: "Machine Learning course ka fee kya hai?",
  lastContactedAt: new Date(Date.now() - i * 3600000).toISOString(),
}));

const conversations: WaConversation[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `cv${i + 1}`,
  contactId: contacts[i].id,
  status: (["open", "pending", "resolved"] as const)[i % 3],
  assignedAgentId: agents[i % agents.length].id,
  isAi: i % 4 === 0,
  unread: i % 3 === 0 ? 2 : 0,
  lastMessage: contacts[i].lastMessage || "Hello",
  lastAt: contacts[i].lastContactedAt || new Date().toISOString(),
}));

const messagesByConversation: Record<string, WaMessage[]> = {};

conversations.forEach((cv, idx) => {
  const t = new Date(cv.lastAt).getTime();
  messagesByConversation[cv.id] = [
    {
      id: `${cv.id}-m1`,
      conversationId: cv.id,
      direction: "inbound",
      body: idx % 2 === 0 ? "Machine Learning course ka fee kya hai?" : "Registration kab start hoga?",
      status: "read",
      at: new Date(t - 120000).toISOString(),
    },
    {
      id: `${cv.id}-m2`,
      conversationId: cv.id,
      direction: "outbound",
      body:
        idx % 2 === 0
          ? "Our Machine Learning course is available for ₹2,599. Would you like course details?"
          : "Registration is open. Share your email and we will guide you.",
      status: "delivered",
      at: new Date(t - 60000).toISOString(),
      isAi: cv.isAi,
    },
  ];
});

const leads: WaLead[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `l${i + 1}`,
  title: `Lead ${i + 1} — Course inquiry`,
  contactId: contacts[i].id,
  stage: ["new", "contacted", "qualified", "interested", "follow_up", "converted", "lost"][i % 7],
  source: contacts[i].source,
  assignedAgentId: contacts[i].assignedAgentId,
}));

const campaigns: WaCampaign[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `cp${i + 1}`,
  name: ["Course Promotion", "Webinar Invite", "Fee Reminder", "New Batch", "Alumni Offer"][i],
  status: ["draft", "scheduled", "running", "completed", "paused"][i],
  sent: 1000 + i * 200,
  delivered: 950 + i * 180,
  read: 700 + i * 120,
  replied: 120 + i * 15,
  failed: 10 + i,
  optOuts: 3 + i,
}));

const templates: WaTemplate[] = [
  {
    id: "t1",
    name: "Course Promotion",
    category: "marketing",
    language: "en",
    body: "Hello {{name}}, your {{course}} registration is now open.",
    status: "approved",
  },
  {
    id: "t2",
    name: "OTP Verify",
    category: "authentication",
    language: "en",
    body: "Your verification code is {{1}}.",
    status: "approved",
  },
  {
    id: "t3",
    name: "Payment Receipt",
    category: "utility",
    language: "en",
    body: "Payment received for {{course}}. Thank you!",
    status: "pending",
  },
];

export function waCrmDemoMode(): boolean {
  return (
    process.env.WA_CRM_DEMO_MODE === "true" ||
    !process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    !process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

export function getWaCrmDemoSnapshot() {
  const openConversations = conversations.filter((c) => c.status === "open").length;
  const unread = conversations.reduce((s, c) => s + c.unread, 0);
  const aiChats = conversations.filter((c) => c.isAi).length;

  return {
    demoMode: true,
    kpis: {
      totalContacts: contacts.length,
      newLeads: leads.filter((l) => l.stage === "new").length,
      openConversations,
      unreadMessages: unread,
      aiConversations: aiChats,
      todaysMessages: 248,
      campaignMessages: campaigns.reduce((s, c) => s + c.sent, 0),
      conversionRate: 12.4,
    },
    conversationVolume: {
      today: [12, 18, 22, 15, 30, 28, 35, 40, 38, 42, 45, 50],
      week: [120, 132, 145, 160, 155, 170, 180],
      month: Array.from({ length: 30 }).map((_, i) => 80 + (i % 7) * 12),
    },
    leadSources: [
      { name: "Website", value: 28 },
      { name: "WhatsApp", value: 35 },
      { name: "Facebook", value: 12 },
      { name: "Instagram", value: 8 },
      { name: "Referral", value: 10 },
      { name: "CSV", value: 4 },
      { name: "Manual", value: 3 },
    ],
    agents,
    campaigns,
    templates,
    contacts,
    conversations,
    leads,
    messagesByConversation,
    aiSettings: {
      enabled: true,
      autoReply: true,
      handoverEnabled: true,
      confidenceThreshold: 0.65,
      systemInstructions:
        "Answer using approved course/pricing FAQs only. Escalate payment and account issues to humans.",
      fallbackMessage: "I'll connect you with our support team.",
    },
    whatsappConfig: {
      configured: false,
      businessName: "WA CRM Demo",
      displayPhone: "+91 XXXXX XXXXX",
      apiVersion: "v21.0",
    },
    compliance: {
      optInContacts: contacts.filter((c) => c.optIn).length,
      optOutContacts: contacts.filter((c) => c.optOut).length,
      suppressed: 2,
      templateApproved: templates.filter((t) => t.status === "approved").length,
      failedMessages24h: 4,
    },
  };
}
