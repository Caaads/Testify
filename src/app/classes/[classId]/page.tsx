import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClassDetailClient } from "./view";

type OwnershipCandidate = {
  id: string;
  name: string;
};

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [
    { data: classData },
    { data: joinRequests },
    { data: terms },
    { data: quizzes },
    { data: announcements },
    { data: myMembership },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, description, year_level, teacher_id")
      .eq("id", classId)
      .single(),
    supabase
      .from("class_join_requests")
      .select("id, status, created_at, student_id, student_name, student_role, requested_role, profiles(full_name)")
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("terms")
      .select("id, name")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("quizzes")
      .select("id, title, term_id, duration, total_score, allow_auto_score, allow_review, opens_at, closes_at, quiz_password, created_at, created_by, profiles(full_name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }),
    supabase
      .from("announcements")
      .select("id, content, created_at, created_by, profiles(full_name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(5),
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

  const isTeacherOwner = classData.teacher_id === profile.id;
  const isAdmin = profile.role === "admin";
  const isTeacherMemberManager = myMembership?.member_role === "teacher";
  const canManage = isTeacherOwner || isAdmin || isTeacherMemberManager;
  const isMember = Boolean(myMembership) || canManage;
  const canLeave = Boolean(myMembership) && !isTeacherOwner && !isAdmin;

  const { data: classTeacherProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", classData.teacher_id)
    .maybeSingle();

  const announcementCreatorIds = [
    ...new Set((announcements ?? []).map((item: { created_by: string | null }) => item.created_by).filter(Boolean)),
  ] as string[];
  const { data: announcementCreatorProfiles } =
    announcementCreatorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", announcementCreatorIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const announcementCreatorMap = new Map(
    (announcementCreatorProfiles ?? []).map((profile) => [profile.id, profile.full_name] as const),
  );

  const { data: teacherMembers } = await supabase
    .from("class_students")
    .select("student_id, student_name, member_role, profiles(full_name, role)")
    .eq("class_id", classId)
    .neq("student_id", classData.teacher_id);

  const classCreatorName = classTeacherProfile?.full_name || "Unknown Teacher";
  const announcementsWithCreators = (announcements ?? []).map(
    (item: {
      id: string;
      content: string | null;
      created_at: string;
      created_by: string | null;
      profiles?: { full_name: string | null }[];
    }) => ({
      ...item,
      profiles: item.profiles ?? [],
      creator_name:
        (item.created_by ? announcementCreatorMap.get(item.created_by) : null) ||
        item.profiles?.[0]?.full_name ||
        classCreatorName,
    }),
  );
  const ownershipCandidates: OwnershipCandidate[] = (teacherMembers ?? [])
    .filter((entry: { profiles: { role: string; full_name: string | null }[] }) => entry.profiles?.[0]?.role === "teacher")
    .map((entry: {
      student_id: string;
      student_name: string | null;
      profiles: { full_name: string | null }[];
    }) => ({
      id: entry.student_id,
      name: entry.student_name || entry.profiles?.[0]?.full_name || "Teacher Member",
    }));

  if (!isMember && !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          You must be a class member first before viewing this class.
        </p>
      </div>
    );
  }

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title={classData.name}
      subtitle={`Year level: ${classData.year_level || "N/A"} | Created by: ${classCreatorName}`}
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/classes/${classId}/announcements`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
          >
            Announcements
          </Link>
          <Link
            href={`/classes/${classId}/members`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
          >
            Members
          </Link>
          <Link
            href={`/classes/${classId}/scoreboard`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
          >
            Scoreboard
          </Link>
        </div>

        <ClassDetailClient
          classId={classId}
          role={profile.role}
          canManage={canManage}
          isOwner={isTeacherOwner}
          className={classData.name}
          classDescription={classData.description || ""}
          classCreatorName={classCreatorName}
          canLeave={canLeave}
          ownershipCandidates={ownershipCandidates}
          joinRequests={joinRequests ?? []}
          terms={terms ?? []}
          quizzes={quizzes ?? []}
           announcements={announcementsWithCreators}
        />
      </div>
    </AppShell>
  );
}
