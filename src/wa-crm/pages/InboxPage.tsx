import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bot, Paperclip, Send, Sparkles } from "lucide-react";
import { useWaCrm } from "@/wa-crm/context/WaCrmContext";
import { fetchWaCrmMessages, sendWaCrmMessage, suggestAiReply } from "@/wa-crm/api/waCrmClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  direction: string;
  body: string;
  status: string;
  at: string;
  isAi?: boolean;
};

export function InboxPage() {
  const { data } = useWaCrm();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const conversations = data?.conversations ?? [];
  const contacts = data?.contacts ?? [];
  const agents = data?.agents ?? [];

  const filtered = useMemo(() => {
    return conversations.filter((c: { status: string; isAi: boolean; unread: number; assignedAgentId?: string }) => {
      if (filter === "open") return c.status === "open";
      if (filter === "pending") return c.status === "pending";
      if (filter === "resolved") return c.status === "resolved";
      if (filter === "ai") return c.isAi;
      if (filter === "unread") return c.unread > 0;
      return true;
    });
  }, [conversations, filter]);

  const activeId = conversationId || filtered[0]?.id;
  const active = conversations.find((c: { id: string }) => c.id === activeId);
  const contact = contacts.find((c: { id: string }) => c.id === active?.contactId);
  const agent = agents.find((a: { id: string }) => a.id === active?.assignedAgentId);

  useEffect(() => {
    if (!activeId) return;
    void fetchWaCrmMessages(activeId).then((r) => setMessages(r.messages as Msg[]));
  }, [activeId]);

  const onSend = async () => {
    if (!draft.trim() || !contact) return;
    await sendWaCrmMessage({
      to: contact.whatsappNumber,
      body: draft.trim(),
      conversationId: activeId,
    });
    setDraft("");
    setAiSuggestion(null);
    const r = await fetchWaCrmMessages(activeId!);
    setMessages(r.messages as Msg[]);
  };

  const onAiSuggest = async () => {
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const r = await suggestAiReply(lastInbound?.body || "Hello");
    setAiSuggestion(r.text);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-3 min-h-[480px]">
      <Card className="lg:w-80 flex flex-col rounded-xl overflow-hidden shrink-0">
        <div className="p-3 border-b space-y-2">
          <Input placeholder="Search chats…" className="h-8 text-sm" />
          <div className="flex flex-wrap gap-1">
            {["all", "unread", "open", "pending", "ai"].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className="h-7 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((cv: { id: string; contactId: string; lastMessage: string; lastAt: string; unread: number; status: string }) => {
            const c = contacts.find((x: { id: string }) => x.id === cv.contactId);
            return (
              <button
                key={cv.id}
                type="button"
                onClick={() => navigate(`/admin/wa-crm/inbox/${cv.id}`)}
                className={cn(
                  "w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition",
                  activeId === cv.id && "bg-sky-50"
                )}
              >
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{c?.fullName || "Contact"}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(cv.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{cv.lastMessage}</p>
                <div className="flex gap-1 mt-1">
                  {cv.unread > 0 && <Badge className="h-5 text-[10px]">{cv.unread}</Badge>}
                  <Badge variant="outline" className="h-5 text-[10px] capitalize">
                    {cv.status}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex-1 flex flex-col rounded-xl overflow-hidden min-w-0">
        {active && contact ? (
          <>
            <div className="p-3 border-b flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{contact.fullName}</p>
                <p className="text-xs text-muted-foreground">+{contact.whatsappNumber}</p>
              </div>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">{active.status}</Badge>
                {active.isAi && <Badge className="bg-violet-600">AI</Badge>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/80">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.direction === "inbound"
                      ? "bg-white border mr-auto"
                      : "bg-sky-600 text-white ml-auto"
                  )}
                >
                  <p>{m.body}</p>
                  <p className="text-[10px] opacity-70 mt-1 flex gap-2">
                    {new Date(m.at).toLocaleTimeString()}
                    {m.direction !== "inbound" && <span>{m.status}</span>}
                    {m.isAi && <span>AI</span>}
                  </p>
                </div>
              ))}
            </div>
            {aiSuggestion && (
              <div className="mx-3 mb-2 p-3 rounded-lg border bg-violet-50 text-sm">
                <p className="font-medium text-violet-900 flex items-center gap-1">
                  <Sparkles className="size-3.5" /> AI suggested reply
                </p>
                <p className="mt-1 text-violet-950">{aiSuggestion}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => setDraft(aiSuggestion)}>
                    Use reply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAiSuggestion(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
            <div className="p-3 border-t flex gap-2 items-center">
              <Button variant="outline" size="icon" type="button">
                <Paperclip className="size-4" />
              </Button>
              <Button variant="outline" size="icon" type="button" onClick={() => void onAiSuggest()}>
                <Bot className="size-4" />
              </Button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => e.key === "Enter" && void onSend()}
              />
              <Button onClick={() => void onSend()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
            No conversations yet. Connect WhatsApp or start a conversation to see messages here.
          </div>
        )}
      </Card>

      <Card className="lg:w-72 rounded-xl p-4 space-y-4 shrink-0 hidden xl:block">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</h3>
        {contact ? (
          <>
            <p className="font-bold text-lg">{contact.fullName}</p>
            <p className="text-sm text-muted-foreground">+{contact.whatsappNumber}</p>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Lead:</span> {contact.leadStatus}
              </p>
              <p>
                <span className="text-muted-foreground">Assigned:</span> {agent?.fullName || "Unassigned"}
              </p>
              <p>
                <span className="text-muted-foreground">Source:</span> {contact.source}
              </p>
              <div className="flex flex-wrap gap-1">
                {contact.tags?.map((t: string) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              Assign chat
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a conversation</p>
        )}
      </Card>
    </div>
  );
}
