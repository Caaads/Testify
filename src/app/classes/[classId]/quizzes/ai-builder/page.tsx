import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreateQuizClient } from "../create/view";

export default async function AiQuizBuilderPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: classData }, { data: terms }, { data: myMembership }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("id", classId)
      .single(),
    supabase
      .from("terms")
      .select("id, name")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
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

  const isTeacherMember = myMembership?.member_role === "teacher";
  const canManage = profile.role === "admin" || classData.teacher_id === profile.id || isTeacherMember;
  if (!canManage) {
    notFound();
  }

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="AI Test Builder"
      subtitle={`Class: ${classData.name}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <CreateQuizClient classId={classId} terms={terms ?? []} showAiBuilder />
      </div>
    </AppShell>
  );
}