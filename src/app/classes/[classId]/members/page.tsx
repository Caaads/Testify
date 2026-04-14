import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClassMembersClient } from "./view";

type MemberItem = {
  id: string;
  name: string;
  role: "teacher" | "student";
  joinedAt: string | null;
  isOwner: boolean;
};

export default async function ClassMembersPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .single();

  if (!classData) {
    notFound();
  }

  const [{ data: memberships }, { data: teacherProfile }, { data: myMembership }] =
    await Promise.all([
      supabase
        .from("class_students")
        .select("student_id, student_name, joined_at, member_role, profiles(full_name, role)")
        .eq("class_id", classId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", classData.teacher_id)
        .maybeSingle(),
      supabase
        .from("class_students")
        .select("id, member_role")
        .eq("class_id", classId)
        .eq("student_id", profile.id)
        .maybeSingle(),
    ]);

  const canManage =
    profile.role === "admin" ||
    classData.teacher_id === profile.id ||
    myMembership?.member_role === "teacher";
  const isMember = Boolean(myMembership) || canManage;
  if (!isMember && profile.role !== "admin") {
    notFound();
  }

  const memberMap = new Map<string, MemberItem>();

  memberMap.set(classData.teacher_id, {
    id: classData.teacher_id,
    name: teacherProfile?.full_name || "Class Teacher",
    role: "teacher",
    joinedAt: null,
    isOwner: true,
  });

  (memberships ?? []).forEach((entry: {
    student_id: string;
    student_name: string | null;
    joined_at: string;
    member_role: string | null;
    profiles: { full_name: string | null; role: string }[];
  }) => {
    const prof = entry.profiles?.[0];
    memberMap.set(entry.student_id, {
      id: entry.student_id,
      name: entry.student_name || prof?.full_name || "Unnamed Member",
      role: entry.member_role === "teacher" ? "teacher" : "student",
      joinedAt: entry.joined_at,
      isOwner: entry.student_id === classData.teacher_id,
    });
  });

  const members = Array.from(memberMap.values()).sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Members"
      subtitle={`Class: ${classData.name}`}
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex justify-end">
          <Link href={`/classes/${classId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Back to class
          </Link>
        </div>

        <ClassMembersClient
          classId={classId}
          members={members}
          canManage={canManage}
          currentUserId={profile.id}
        />
      </div>
    </AppShell>
  );
}
