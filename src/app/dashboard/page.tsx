import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { canCreateClass, requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StudentSchedulePanel } from "./StudentSchedulePanel";

type StudentClass = {
  class_id: string;
  joined_at: string;
  member_role: string | null;
  classes: {
    id: string;
    name: string;
    year_level: string | null;
  };
};

type ScheduledQuiz = {
  id: string;
  title: string;
  class_id: string;
  opens_at: string | null;
  closes_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No schedule";
  }
  return new Date(value).toLocaleString();
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function loadCreatorNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  creatorIds: string[],
) {
  if (creatorIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", creatorIds);

  return new Map((data ?? []).map((item) => [item.id, item.full_name || ""] as const));
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile) {
    redirect("/login");
  }

  const [{ data: classes }, { data: memberships }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, year_level, created_at")
      .eq("teacher_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("class_students")
      .select("class_id, joined_at, member_role, classes!inner(id, name, year_level)")
      .eq("student_id", profile.id)
      .order("joined_at", { ascending: false }),
  ]);

  let pendingTeacherCount = 0;
  if (profile.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher")
      .eq("teacher_status", "pending");
    pendingTeacherCount = count ?? 0;
  }

  const joinedClasses = (memberships as unknown as StudentClass[] | null) ?? [];
  const joinedClassIds = joinedClasses.map((item) => item.class_id);

  // Fetch recent activity (announcements and quizzes)
  let recentActivity: Array<{
    type: "announcement" | "quiz";
    id: string;
    classId: string;
    className: string;
    title?: string;
    content?: string;
    createdAt: string;
    creator?: string;
  }> = [];

  if (profile.role === "student" && joinedClassIds.length > 0) {
    const [{ data: announcements }, { data: quizzes }] = await Promise.all([
      supabase
        .from("announcements")
        .select("id, class_id, content, created_at, created_by")
        .in("class_id", joinedClassIds)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("quizzes")
        .select("id, class_id, title, created_at, created_by, profiles(full_name)")
        .in("class_id", joinedClassIds)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const classNameMap = new Map(joinedClasses.map((item) => [item.class_id, item.classes.name]));
    const creatorMap = await loadCreatorNames(
      supabase,
      [...new Set((announcements || []).map((item: any) => item.created_by).filter(Boolean))] as string[],
    );

    const announcementItems = (announcements || []).map((item: any) => ({
      type: "announcement" as const,
      id: item.id,
      classId: item.class_id,
      className: classNameMap.get(item.class_id) || "Class",
      content: item.content,
      createdAt: item.created_at,
      creator: item.created_by ? creatorMap.get(item.created_by) || "Creator unavailable" : "Creator unavailable",
    }));

    const quizItems = (quizzes || []).map((item: any) => ({
      type: "quiz" as const,
      id: item.id,
      classId: item.class_id,
      className: classNameMap.get(item.class_id) || "Class",
      title: item.title,
      createdAt: item.created_at,
      creator: item.profiles?.full_name || "Unknown",
    }));

    recentActivity = [...announcementItems, ...quizItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  } else if ((profile.role === "teacher" || profile.role === "admin") && classes && classes.length > 0) {
    const teacherClassIds = classes.map((c) => c.id);
    const allClassIds = [...new Set([...teacherClassIds, ...joinedClassIds])];

    if (allClassIds.length > 0) {
      const [{ data: announcements }, { data: quizzes }] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, class_id, content, created_at, created_by")
          .in("class_id", allClassIds)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("quizzes")
          .select("id, class_id, title, created_at, created_by, profiles(full_name)")
          .in("class_id", allClassIds)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const classNameMap = new Map<string, string>([
        ...joinedClasses.map((item) => [item.class_id, item.classes.name] as const),
        ...(classes || []).map((item) => [item.id, item.name] as const),
      ]);
      const creatorMap = await loadCreatorNames(
        supabase,
        [...new Set((announcements || []).map((item: any) => item.created_by).filter(Boolean))] as string[],
      );

      const announcementItems = (announcements || []).map((item: any) => ({
        type: "announcement" as const,
        id: item.id,
        classId: item.class_id,
        className: classNameMap.get(item.class_id) || "Class",
        content: item.content,
        createdAt: item.created_at,
        creator: item.created_by ? creatorMap.get(item.created_by) || "Creator unavailable" : "Creator unavailable",
      }));

      const quizItems = (quizzes || []).map((item: any) => ({
        type: "quiz" as const,
        id: item.id,
        classId: item.class_id,
        className: classNameMap.get(item.class_id) || "Class",
        title: item.title,
        createdAt: item.created_at,
        creator: item.profiles?.full_name || "Unknown",
      }));

      recentActivity = [...announcementItems, ...quizItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    }
  }

  let scheduledQuizzes: ScheduledQuiz[] = [];
  let teacherScheduledQuizzes: ScheduledQuiz[] = [];
  
  if (profile.role === "student" && joinedClassIds.length > 0) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, class_id, opens_at, closes_at")
      .in("class_id", joinedClassIds)
      .not("opens_at", "is", null)
      .order("opens_at", { ascending: true })
      .limit(60);

    scheduledQuizzes = (quizzes as ScheduledQuiz[] | null) ?? [];
  } else if ((profile.role === "teacher" || profile.role === "admin") && classes && classes.length > 0) {
    const teacherClassIds = classes.map((c) => c.id);
    const allClassIds = [...new Set([...teacherClassIds, ...joinedClassIds])];
    
    if (allClassIds.length > 0) {
      const { data: quizzes } = await supabase
        .from("quizzes")
        .select("id, title, class_id, opens_at, closes_at")
        .in("class_id", allClassIds)
        .not("opens_at", "is", null)
        .order("opens_at", { ascending: true })
        .limit(60);

      teacherScheduledQuizzes = (quizzes as ScheduledQuiz[] | null) ?? [];
    }
  }

  const classNameById = new Map(joinedClasses.map((item) => [item.class_id, item.classes.name]));
  
  // Add teacher's own classes to the map
  if (classes && classes.length > 0) {
    classes.forEach((cls) => {
      classNameById.set(cls.id, cls.name);
    });
  }

  const now = new Date();
  const todayLabel = formatDateLabel(now);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Use appropriate quiz list based on role
  const quizzesToUse = profile.role === "student" ? scheduledQuizzes : teacherScheduledQuizzes;

  const todayQuizzes = quizzesToUse.filter((quiz) => {
    if (!quiz.opens_at) {
      return false;
    }
    const openTime = new Date(quiz.opens_at);
    return openTime >= todayStart && openTime < tomorrowStart;
  });

  const upcomingQuizzes = quizzesToUse.filter((quiz) => {
    if (!quiz.opens_at) {
      return false;
    }
    return new Date(quiz.opens_at) >= todayStart;
  });

  const scheduleItems = quizzesToUse.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    className: classNameById.get(quiz.class_id) || "Class",
    opensAt: quiz.opens_at,
    closesAt: quiz.closes_at,
  }));

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Overview"
      subtitle="Track classes, approvals, and activity in one place."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-6">
        {profile.role === "student" ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Joined classes</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{joinedClasses.length}</h2>
                <p className="mt-2 text-sm text-zinc-600">Classes where you are currently enrolled.</p>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Tests today</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{todayQuizzes.length}</h2>
                <p className="mt-2 text-sm text-zinc-600">Scheduled tests opening today.</p>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Upcoming schedules</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{upcomingQuizzes.length}</h2>
                <p className="mt-2 text-sm text-zinc-600">All upcoming tests from your joined classes.</p>
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <h3 className="text-lg font-semibold text-zinc-900">Latest activity</h3>
                <div className="mt-4 space-y-2">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.type === "announcement" ? `/classes/${item.classId}/announcements` : `/quizzes/${item.id}`}
                        className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-zinc-900">{item.className}</p>
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold capitalize text-sky-800">
                            {item.type}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-600">
                          {item.type === "announcement" ? item.content : item.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">by {item.creator}</p>
                        <p className="text-xs text-zinc-500">{formatDateTime(item.createdAt)}</p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">No recent activity.</p>
                  )}
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <h3 className="text-lg font-semibold text-zinc-900">Schedules Today {todayLabel}</h3>
                <div className="mt-4 space-y-2">
                  {todayQuizzes.map((quiz) => (
                    <div key={quiz.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                      <p className="font-semibold text-zinc-900">{quiz.title}</p>
                      <p className="text-zinc-600">{classNameById.get(quiz.class_id) || "Class"}</p>
                      <p className="text-xs text-zinc-500">Opens: {formatDateTime(quiz.opens_at)}</p>
                    </div>
                  ))}

                  {todayQuizzes.length === 0 ? (
                    <p className="text-sm text-zinc-500">No test schedule for today.</p>
                  ) : null}
                </div>
              </article>
            </section>

            <StudentSchedulePanel schedules={scheduleItems} />
          </>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Role</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900 capitalize">{profile.role}</h2>
                {profile.role === "teacher" ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    Approval status: <span className="font-semibold capitalize">{profile.teacher_status}</span>
                  </p>
                ) : null}
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Teacher classes</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{classes?.length ?? 0}</h2>
                <p className="mt-2 text-sm text-zinc-600">Classes you own as teacher/admin.</p>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <p className="text-sm text-zinc-500">Student classes</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{memberships?.length ?? 0}</h2>
                {profile.role === "admin" ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    Pending teacher approvals: <span className="font-semibold">{pendingTeacherCount}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">Classes where you are enrolled as student.</p>
                )}
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <h3 className="text-lg font-semibold text-zinc-900">Quick actions</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link href="/classes" className="rounded-lg bg-sky-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-sky-700">
                    Open classes
                  </Link>
                  {profile.role === "admin" ? (
                    <Link
                      href="/admin/teacher-approvals"
                      className="rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      Review teachers
                    </Link>
                  ) : null}
                </div>
                {!canCreateClass(profile) && profile.role === "teacher" ? (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Teacher account is pending approval. You can view classes but cannot create one yet.
                  </p>
                ) : null}
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <h3 className="text-lg font-semibold text-zinc-900">All your classes</h3>
                <div className="mt-4 space-y-2">
                  {(classes ?? []).map((item) => (
                    <Link
                      key={item.id}
                      href={`/classes/${item.id}`}
                      className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
                    >
                      <p className="font-semibold text-zinc-900">{item.name}</p>
                      <p className="text-zinc-600">Year: {item.year_level || "N/A"}</p>
                      <p className="text-xs text-zinc-500">Owned by you</p>
                    </Link>
                  ))}
                  
                  {joinedClasses.length > 0 && (
                    <>
                      {joinedClasses.map((item) => (
                        <Link
                          key={`student-${item.class_id}-${item.joined_at}`}
                          href={`/classes/${item.class_id}`}
                          className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
                        >
                          <p className="font-semibold text-zinc-900">{item.classes.name}</p>
                          <p className="text-zinc-600">Year: {item.classes.year_level || "N/A"}</p>
                          {item.member_role === "teacher" ? (
                            <p className="text-xs text-emerald-700">Joined as teacher</p>
                          ) : null}
                          <p className="text-xs text-zinc-500">Joined: {formatDateTime(item.joined_at)}</p>
                        </Link>
                      ))}
                    </>
                  )}

                  {(!classes || classes.length === 0) && joinedClasses.length === 0 && (
                    <p className="text-sm text-zinc-500">No classes yet. Create one in the classes page.</p>
                  )}
                </div>
              </article>
            </section>

            {teacherScheduledQuizzes.length > 0 && <StudentSchedulePanel schedules={scheduleItems} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
