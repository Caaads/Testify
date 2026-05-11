import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StudentSchedulePanel } from "./StudentSchedulePanel";
import { ActionTile } from "./ActionTile";

type StudentClass = {
  class_id: string;
  joined_at: string;
  member_role: string | null;
  classes: {
    id: string;
    name: string;
    year_level: string | null;
    strand: string | null;
    course: string | null;
    teacher_id: string;
  };
};

type TeacherClass = {
  id: string;
  name: string;
  year_level: string | null;
  strand: string | null;
  course: string | null;
  created_at: string;
};

type ScheduledQuiz = {
  id: string;
  title: string;
  class_id: string;
  opens_at: string | null;
  closes_at: string | null;
};

type RecentAnnouncement = {
  id: string;
  classId: string;
  className: string;
  content: string | null;
  createdAt: string;
  teacherName: string;
};

type PlatformRoleStats = {
  student: number;
  teacher: number;
  admin: number;
};

type UpcomingEvent = {
  id: string;
  title: string;
  className: string;
  opensAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "No schedule";
  return new Date(value).toLocaleString();
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatUpcomingEventDate(value: string | null) {
  if (!value) return "No schedule";

  const date = new Date(value);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RolePieChart({ stats }: { stats: PlatformRoleStats }) {
  const total = stats.student + stats.teacher + stats.admin;
  const studentPercent = total > 0 ? (stats.student / total) * 100 : 0;
  const teacherPercent = total > 0 ? (stats.teacher / total) * 100 : 0;

  const chartBackground =
    total > 0
      ? `conic-gradient(#38bdf8 0 ${studentPercent}%, #a78bfa ${studentPercent}% ${studentPercent + teacherPercent}%, #f59e0b ${studentPercent + teacherPercent}% 100%)`
      : "conic-gradient(#cbd5e1 0 100%)";

  const items = [
    { label: "Students", value: stats.student, color: "bg-sky-400" },
    { label: "Teachers", value: stats.teacher, color: "bg-violet-400" },
    { label: "Admins", value: stats.admin, color: "bg-amber-400" },
  ];

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Platform users</h3>
        <span className="text-sm text-[var(--muted)]">Joined accounts</span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
          <div
            className="relative h-36 w-36 rounded-full"
            style={{ background: chartBackground }}
            aria-label={`Students ${stats.student}, Teachers ${stats.teacher}, Admins ${stats.admin}`}
          >
            <div className="absolute inset-[22%] rounded-full border border-[var(--border)] bg-[var(--surface)]" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
              </div>
              <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingTestsPanel({ events }: { events: UpcomingEvent[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Upcoming Tests</h3>
        <span className="text-sm text-[var(--muted)]">{events.length} {events.length === 1 ? 'test' : 'tests'}</span>
      </div>

      <div className="">
        {events.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/quizzes/${event.id}`}
                className="rounded-2xl border border-sky-500/20 bg-[#0b1f56] px-4 py-4 text-white shadow-[var(--shadow)] transition hover:border-cyan-400/30 hover:bg-[#10235f]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cyan-100">{event.title}</p>
                  <p className="mt-1 text-xs text-white/70">{event.className}</p>
                  <p className="mt-3 text-xs text-white/60">{formatUpcomingEventDate(event.opensAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-sky-500/10 bg-[#0b1f56] px-4 py-4 text-white shadow-[var(--shadow)]">
            <p className="text-sm text-cyan-100">There&apos;s no upcoming test for now.</p>
          </div>
        )}
      </div>
    </section>
  );
}

async function loadCreatorNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  creatorIds: string[],
) {
  if (creatorIds.length === 0) return new Map<string, string>();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", creatorIds);
  return new Map((data ?? []).map((item) => [item.id, item.full_name || ""] as const));
}

function isSeniorHighYear(level: string | null) {
  return level === "Grade 11" || level === "Grade 12";
}

function isCollegeYear(level: string | null) {
  return Boolean(level && level.startsWith("College "));
}

function getClassIconConfig(name: string, yearLevel: string | null) {
  const text = `${name} ${yearLevel || ""}`.toLowerCase();
  if (text.includes("math") || text.includes("algebra") || text.includes("geometry") || text.includes("calculus") || text.includes("statistics")) {
    return {
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </svg>
      ),
    };
  }

  if (text.includes("science") || text.includes("biology") || text.includes("chemistry") || text.includes("physics") || text.includes("lab")) {
    return {
      bg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M10 3h4M11 3v6l-4.5 7A3 3 0 0 0 9 20h6a3 3 0 0 0 2.5-4L13 9V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    };
  }

  if (text.includes("history") || text.includes("social") || text.includes("government") || text.includes("world") || text.includes("filipino")) {
    return {
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M4 19V6a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 6v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  if (text.includes("english") || text.includes("literature") || text.includes("reading") || text.includes("writing") || text.includes("language")) {
    return {
      bg: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M18 7h1a1 1 0 0 1 1 1v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  if (text.includes("computer") || text.includes("programming") || text.includes("coding") || text.includes("technology") || text.includes("it")) {
    return {
      bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M4 5h16v11H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 20h8M10 16v4M14 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  if (text.includes("art") || text.includes("music") || text.includes("design") || text.includes("creative")) {
    return {
      bg: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M12 4a8 8 0 1 0 8 8 4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ),
    };
  }

  const initial = name.trim().charAt(0).toUpperCase() || "C";
  return {
    bg: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    icon: <span className="text-sm font-black">{initial}</span>,
  };
}

function ClassCard({
  href,
  name,
  yearLevel,
  teacherName,
}: {
  href: string;
  name: string;
  yearLevel: string | null;
  teacherName: string;
}) {
  const icon = getClassIconConfig(name, yearLevel);

  return (
    <Link
      href={href}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)]"
    >
      <div className="flex items-start justify-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${icon.bg}`}>
          {icon.icon}
        </div>
      </div>
      <h4 className="mt-4 text-base font-semibold text-[var(--foreground)]">{name}</h4>
      <p className="mt-1 text-sm text-[var(--muted)]">{teacherName}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Class overview</p>
      <p className="mt-2 text-right text-xs font-semibold text-[var(--muted)]">{yearLevel || "N/A"}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile) redirect("/login");

  // Unified data fetching for all roles
  const [{ data: ownedClasses }, { data: memberClasses }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, year_level, strand, course, created_at")
      .eq("teacher_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("class_students")
      .select("class_id, joined_at, member_role, classes!inner(id, name, year_level, strand, course, teacher_id)")
      .eq("student_id", profile.id)
      .order("joined_at", { ascending: false }),
  ]);

  const joinedClasses = (memberClasses as unknown as StudentClass[] | null) ?? [];
  const teacherClasses = (ownedClasses as unknown as TeacherClass[] | null) ?? [];
  const joinedClassIds = joinedClasses.map((item) => item.class_id);
  const teacherClassIds = teacherClasses.map((c) => c.id);
  const allClassIds = [...new Set([...teacherClassIds, ...joinedClassIds])];

  // Fetch scheduled quizzes from all relevant classes
  let scheduledQuizzes: ScheduledQuiz[] = [];
  if (profile.role === "admin") {
    // Admins see all scheduled quizzes in the system
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, class_id, opens_at, closes_at")
      .not("opens_at", "is", null)
      .order("opens_at", { ascending: true })
      .limit(60);

    scheduledQuizzes = (quizzes as ScheduledQuiz[] | null) ?? [];
  } else if (allClassIds.length > 0) {
    // Students/teachers see quizzes from their classes
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, class_id, opens_at, closes_at")
      .in("class_id", allClassIds)
      .not("opens_at", "is", null)
      .order("opens_at", { ascending: true })
      .limit(60);

    scheduledQuizzes = (quizzes as ScheduledQuiz[] | null) ?? [];
  }

  // Build class name map for schedules
  const classNameById = new Map<string, string>([
    ...joinedClasses.map((item) => [item.class_id, item.classes.name] as const),
    ...teacherClasses.map((item) => [item.id, item.name] as const),
  ]);

  // For admins, also fetch class names from the quizzes' class_ids
  if (profile.role === "admin" && scheduledQuizzes.length > 0) {
    const classIds = Array.from(new Set(scheduledQuizzes.map((q) => q.class_id)));
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);

    (classes as Array<{ id: string; name: string }> | null)?.forEach((cls) => {
      classNameById.set(cls.id, cls.name);
    });
  }

  // Load teacher names for joined classes so we can show the correct teacher
  const joinedTeacherIds = Array.from(new Set(joinedClasses.map((item) => item.classes.teacher_id).filter(Boolean)));
  const teacherNameMap = await loadCreatorNames(supabase, joinedTeacherIds as string[]);

  const now = new Date();
  const upcomingEvents: UpcomingEvent[] = scheduledQuizzes
    .filter((quiz) => {
      if (!quiz.opens_at) return false;
      // Only include tests that haven't closed yet
      if (quiz.closes_at) {
        const closesAt = new Date(quiz.closes_at);
        if (closesAt <= now) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by opens_at ascending (nearest first)
      const aDate = a.opens_at ? new Date(a.opens_at).getTime() : Infinity;
      const bDate = b.opens_at ? new Date(b.opens_at).getTime() : Infinity;
      return aDate - bDate;
    })
    .map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      className: classNameById.get(quiz.class_id) || "Class",
      opensAt: quiz.opens_at,
    }))
    .slice(0, 4);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const todayTests = scheduledQuizzes.filter((quiz) => {
    if (!quiz.opens_at) return false;
    const openTime = new Date(quiz.opens_at);
    return openTime >= todayStart && openTime < tomorrowStart;
  });

  const scheduleItems = scheduledQuizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    className: classNameById.get(quiz.class_id) || "Class",
    opensAt: quiz.opens_at,
    closesAt: quiz.closes_at,
  }));

  let recentAnnouncements: RecentAnnouncement[] = [];
  if (allClassIds.length > 0) {
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, class_id, content, created_at, created_by")
      .in("class_id", allClassIds)
      .order("created_at", { ascending: false })
      .limit(4);

    const teacherIds = [...new Set([
      profile.id,
      ...joinedClasses.map((item) => item.classes.teacher_id).filter(Boolean),
    ])] as string[];
    const teacherMap = await loadCreatorNames(supabase, teacherIds);

    recentAnnouncements = (announcements ?? []).map((item: any) => ({
      id: item.id,
      classId: item.class_id,
      className: classNameById.get(item.class_id) || "Class",
      content: item.content,
      createdAt: item.created_at,
      teacherName: item.created_by ? teacherMap.get(item.created_by) || "Unknown teacher" : "Unknown teacher",
    }));
  }

  let platformStats: PlatformRoleStats = { student: 0, teacher: 0, admin: 0 };
  if (profile.role === "admin") {
    const { data: profiles } = await supabase.from("profiles").select("role");
    platformStats = (profiles ?? []).reduce<PlatformRoleStats>(
      (accumulator, item: { role: string | null }) => {
        if (item.role === "student") accumulator.student += 1;
        if (item.role === "teacher") accumulator.teacher += 1;
        if (item.role === "admin") accumulator.admin += 1;
        return accumulator;
      },
      { student: 0, teacher: 0, admin: 0 },
    );
  }

  const enrolledCards = [...teacherClasses.map((item) => ({
    href: `/classes/${item.id}`,
    name: item.name,
    yearLevel: item.year_level,
    teacherName: profile.full_name || "You",
  })), ...joinedClasses.map((item) => ({
    href: `/classes/${item.class_id}`,
    name: item.classes.name,
    yearLevel: item.classes.year_level,
    teacherName: teacherNameMap.get(item.classes.teacher_id) || "Unknown Teacher",
  }))].sort((left, right) => left.name.localeCompare(right.name));

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Overview"
      subtitle="Track enrolled classes and test schedules in one place."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Welcome back, {profile.full_name || "User"}.</p>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Track enrolled classes, upcoming tests, and the latest announcements in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">{allClassIds.length} {allClassIds.length === 1 ? 'class' : 'classes'}</span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">{todayTests.length} {todayTests.length === 1 ? 'test today' : 'tests today'}</span>
            </div>
          </div>
        </section>

        {profile.role === "admin" ? (
          <section>
            <RolePieChart stats={platformStats} />
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">My Enrolled Classes</h3>
                <Link href="/classes" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
                  View All
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {enrolledCards.map((item) => (
                  <ClassCard
                    key={`${item.href}-${item.name}`}
                    href={item.href}
                    name={item.name}
                    yearLevel={item.yearLevel}
                    teacherName={item.teacherName}
                  />
                ))}

                {profile.role === "student" ? (
                  <ActionTile href="/classes" title="Join a New Class" subtitle="Enter Class name" />
                ) : null}
                {profile.role === "teacher" || profile.role === "admin" ? (
                  <ActionTile href="/classes" title="Create a New Class" subtitle="Set up a new learning space" />
                ) : null}
              </div>
            </section>

            <section>
              <StudentSchedulePanel schedules={scheduleItems} />
            </section>
          </div>

          <aside className="space-y-6">
            <UpcomingTestsPanel events={upcomingEvents} />

            {recentAnnouncements.length > 0 ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Announcements</h3>
                  <span className="text-sm text-[var(--muted)]">Latest class updates</span>
                </div>

                <div className="mt-4 grid gap-3">
                  {recentAnnouncements.map((announcement) => (
                    <article
                      key={announcement.id}
                      className="rounded-2xl border border-sky-500/20 bg-[#0b1f56] px-4 py-4 text-white shadow-[var(--shadow)]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-cyan-100">{announcement.className}</p>
                        <p className="mt-1 text-xs text-white/70">by {announcement.teacherName}</p>
                        <p className="mt-3 line-clamp-3 text-sm text-white/90">{announcement.content || "No content"}</p>
                        <p className="mt-3 text-xs text-white/60">{formatDateTime(announcement.createdAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
