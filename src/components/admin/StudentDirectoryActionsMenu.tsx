import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StudentDirectoryStudent = {
  id: string;
  status?: string | null;
  full_name?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

type Props = {
  student: StudentDirectoryStudent;
  onViewDetails: (student: StudentDirectoryStudent) => void;
};

/** Single View action — full profile, edit, documents, and login open in the detail dialog. */
export function StudentDirectoryActionsMenu({ student, onViewDetails }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 h-8 font-bold"
      onClick={() => onViewDetails(student)}
    >
      <Eye className="size-4" />
      View
    </Button>
  );
}
