import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClassAnnouncementsClient } from "./view";

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: classData }, { data: myMembership }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("id", classId)
      .single(),
    supabase
      .from("class_students")
      .select("id, member_role")
      .eq("class_id", classId)
      .eq("student_id", profile.id)
      .maybeSingle(),
  ]);

  if (!classData) {
    notFound();
  }

  const canPost =
    profile.role === "admin" ||
    classData.teacher_id === profile.id ||
    myMembership?.member_role === "teacher";
  const isMember = Boolean(myMembership) || canPost;

  const { data: classTeacherProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", classData.teacher_id)
    .maybeSingle();

  if (!isMember && profile.role !== "admin") {
    notFound();
  }

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Announcements"
      subtitle={`Class: ${classData.name}`}
    >
      <div className="app-enter mx-auto w-full max-w-5xl space-y-4">
        <div className="flex justify-end">
          <Link href={`/classes/${classId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Back to class
          </Link>
        </div>

        <ClassAnnouncementsClient
          classId={classId}
          className={classData.name}
          classTeacherName={classTeacherProfile?.full_name || "Unknown Teacher"}
          canPost={canPost}
        />
      </div>
    </AppShell>
  );
}
