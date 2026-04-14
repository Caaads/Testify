import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { canCreateClass, requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClassesClient } from "./view";

export default async function ClassesPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: classes }, { data: myMemberships }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, description, year_level, teacher_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("class_students")
      .select("class_id, member_role")
      .eq("student_id", profile.id),
  ]);

  const teacherIds = Array.from(new Set((classes ?? []).map((item) => item.teacher_id)));
  const { data: teacherProfiles } =
    teacherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const teacherNameById = Object.fromEntries(
    (teacherProfiles ?? []).map((teacher) => [teacher.id, teacher.full_name || "Unknown Teacher"]),
  );

  const joinedClassIds = new Set((myMemberships ?? []).map((entry) => entry.class_id));
  const joinedClassRoleById = Object.fromEntries(
    (myMemberships ?? []).map((entry) => [entry.class_id, entry.member_role || null]),
  );

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Class Management"
      subtitle="Create, discover, and join classes with approval workflows."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Classes</h2>
          <Link href="/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <ClassesClient
          profileId={profile.id}
          role={profile.role}
          canCreate={canCreateClass(profile)}
          classes={classes ?? []}
          teacherNameById={teacherNameById}
          joinedClassIds={[...joinedClassIds]}
          joinedClassRoleById={joinedClassRoleById}
        />
      </div>
    </AppShell>
  );
}
