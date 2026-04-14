import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TeacherApprovalsClient } from "./view";

export default async function TeacherApprovalsPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createServerSupabaseClient();

  const { data: requests } = await supabase
    .from("profiles")
    .select("id, full_name, role, teacher_status, created_at")
    .eq("role", "teacher")
    .eq("teacher_status", "pending")
    .order("created_at", { ascending: true });

  return (
    <AppShell
      name={profile.full_name || "Admin"}
      role={profile.role}
      title="Teacher Approvals"
      subtitle="Review and approve new educator applications."
    >
      <div className="mx-auto w-full max-w-6xl">
        <TeacherApprovalsClient initialRequests={(requests ?? []) as {
          id: string;
          full_name: string | null;
          role: string;
          teacher_status: string;
          created_at: string;
        }[]} />
      </div>
    </AppShell>
  );
}
