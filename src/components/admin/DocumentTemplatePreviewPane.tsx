import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  title?: string;
  /** Natural document width in CSS units (e.g. "210mm", "794px"). */
  naturalWidth: string;
  /** Natural document height in CSS units — used to reserve scaled space. */
  naturalHeight: string;
  /** Scale factor for fitting preview in sidebar (0–1). */
  scale?: number;
  children: ReactNode;
};

export function DocumentTemplatePreviewPane({
  title = "Live preview",
  naturalWidth,
  naturalHeight,
  scale = 0.42,
  children,
}: Props) {
  const scaledWidth = `calc(${naturalWidth} * ${scale})`;
  const scaledHeight = `calc(${naturalHeight} * ${scale})`;

  return (
    <div className="flex flex-col min-h-0 lg:sticky lg:top-4 lg:self-start w-full">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <Eye className="size-4 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      <ScrollArea className="rounded-xl border border-slate-200 bg-slate-100/90 shadow-inner max-h-[min(78vh,920px)]">
        <div className="p-3">
          <div style={{ width: scaledWidth, height: scaledHeight, position: "relative" }}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: naturalWidth,
                height: naturalHeight,
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </ScrollArea>
      <p className="text-[10px] text-slate-400 mt-2 leading-snug">
        Updates instantly as you edit. Sample student data is shown for reference.
      </p>
    </div>
  );
}
