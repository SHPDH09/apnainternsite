import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
};

export function AdminListPagination({ page, pageSize, total, onPageChange, label = "Showing" }: Props) {
  if (total <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const from = safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
      <span>
        {label} {from}–{to} of {total}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={safePage <= 0}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-1 font-semibold">
          {safePage + 1}/{pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
