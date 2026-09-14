import { BookOpen, ExternalLink, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  StudentEmptyState,
  StudentSectionHeader,
} from "@/components/student/studentDashboardUi";
import {
  classJoinUrl,
  inferLinkTypeFromUrl,
  linkTypeLabel,
  youtubeEmbedUrl,
} from "@/lib/classLinkTargeting";

type LiveClass = {
  id: string;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  link_type?: string | null;
  scheduled_at?: string | null;
  internship_domains?: { name?: string | null } | null;
};

type Props = {
  liveClasses: LiveClass[];
  locked?: boolean;
  onLockedClick?: () => void;
};

export function StudentLiveSessionsSection({ liveClasses, locked, onLockedClick }: Props) {
  return (
    <div id="live-classes-section" className="relative mt-10 student-dash-animate-in">
      {locked ? (
        <button
          type="button"
          className="absolute inset-0 z-20 flex min-h-[200px] items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]"
          onClick={onLockedClick}
        >
          <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
            Live classes locked
          </span>
        </button>
      ) : null}

      <StudentSectionHeader
        icon={Video}
        title="Live sessions"
        subtitle="Scheduled classes and recordings for your internship"
        countLabel={`${liveClasses.length} scheduled`}
      />

      {liveClasses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liveClasses.map((c) => {
            const sessionType =
              c.link_type === "youtube" || inferLinkTypeFromUrl(c.url || "") === "youtube"
                ? "youtube"
                : c.link_type;
            const joinUrl = classJoinUrl(c.url || "", sessionType);
            const embedUrl = sessionType === "youtube" ? youtubeEmbedUrl(c.url || "") : null;

            return (
              <article
                key={c.id}
                className="student-dash-card flex flex-col overflow-hidden border-l-[3px] border-l-[#5AA3E6]"
              >
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-center text-[11px] font-medium text-slate-600">
                  {new Date(c.scheduled_at || "").toLocaleString([], {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </div>

                {sessionType === "youtube" && embedUrl ? (
                  <div className="relative aspect-video w-full bg-black">
                    <iframe
                      src={embedUrl}
                      title={c.title || "Live class"}
                      className="absolute inset-0 h-full w-full border-0"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 border-b border-slate-100 bg-slate-50 p-6 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                      <ExternalLink className="size-6 text-[#5AA3E6]" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">{linkTypeLabel(sessionType)} session</p>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-slate-200 text-[10px] font-medium">
                      {c.internship_domains?.name || "General"}
                    </Badge>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {linkTypeLabel(sessionType)}
                    </span>
                  </div>
                  <h3 className="mb-2 flex-1 text-base font-semibold leading-snug text-slate-900">
                    {c.title}
                  </h3>
                  {c.description ? (
                    <p className="mb-4 line-clamp-2 text-sm text-slate-500">{c.description}</p>
                  ) : null}

                  <div className="mt-auto space-y-2">
                    {sessionType === "youtube" ? (
                      <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                          Live on YouTube
                        </span>
                      </div>
                    ) : null}
                    <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                      <Button className="h-10 w-full gap-2 rounded-lg bg-slate-800 font-medium hover:bg-slate-900">
                        <ExternalLink className="size-4" />
                        {sessionType === "youtube" ? "Join on YouTube" : "Join class"}
                      </Button>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <StudentEmptyState
          icon={BookOpen}
          title="No live sessions scheduled"
          description="Classes will appear here when they are scheduled by your team."
        />
      )}
    </div>
  );
}
