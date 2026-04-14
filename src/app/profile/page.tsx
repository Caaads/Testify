import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileClientView } from "./view";

function isGoogleManagedAccount(providers: unknown): boolean {
  if (!Array.isArray(providers)) {
    return false;
  }

  return providers.includes("google");
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [
    { data: authData },
    { count: classesCreated },
    { count: classesJoined },
    { count: pendingJoinRequests },
    { count: quizzesSubmitted },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", profile.id),
    supabase
      .from("class_students")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id),
    supabase
      .from("class_join_requests")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id),
  ]);

  const providers = authData.user?.app_metadata?.providers;
  const canEditName = !isGoogleManagedAccount(providers);

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="My Profile"
      subtitle="Manage account details and learning activity."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex justify-end">
          <Link href="/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <ProfileClientView
          email={authData.user?.email ?? ""}
          initialName={profile.full_name || ""}
          role={profile.role}
          teacherStatus={profile.teacher_status}
          canEditName={canEditName}
          stats={{
            classesCreated: classesCreated ?? 0,
            classesJoined: classesJoined ?? 0,
            pendingJoinRequests: pendingJoinRequests ?? 0,
            quizzesSubmitted: quizzesSubmitted ?? 0,
          }}
        />
      </div>
    </AppShell>
  );
}