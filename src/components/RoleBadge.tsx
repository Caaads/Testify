import type { UserRole } from "@/lib/supabase/types";

const roleStyles: Record<UserRole, string> = {
  admin: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  teacher: "bg-sky-100/80 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
  student: "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${roleStyles[role]}`}
    >
      {role}
    </span>
  );
}
