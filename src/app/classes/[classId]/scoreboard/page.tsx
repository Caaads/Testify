import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ScoreboardPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: classData }, { data: terms }, { data: quizzes }, { data: students }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("id", classId)
      .single(),
    supabase
      .from("terms")
      .select("id, name")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("quizzes")
      .select("id, title, total_score, term_id")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("class_students")
      .select("student_id, student_name, profiles(full_name)")
      .eq("class_id", classId),
  ]);

  let submissions:
    | { quiz_id: string; student_id: string; score: number }[]
    | null = null;
  if ((quizzes?.length ?? 0) > 0) {
    const { data } = await supabase
      .from("submissions")
      .select("quiz_id, student_id, score")
      .in("quiz_id", (quizzes ?? []).map((quiz) => quiz.id));
    submissions = data as { quiz_id: string; student_id: string; score: number }[];
  }

  const termList = (terms ?? []).map((term) => ({ id: term.id, name: term.name }));
  const termNameMap = new Map(termList.map((term) => [term.id, term.name]));

  const quizzesWithTerm = (quizzes ?? []).map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    totalScore: Number(quiz.total_score ?? 0),
    termId: quiz.term_id || "__unassigned__",
    termName: termNameMap.get(quiz.term_id || "") || "Unassigned",
  }));

  const displayedTerms = (() => {
    const idsFromQuizzes = new Set(quizzesWithTerm.map((quiz) => quiz.termId));
    const base = termList.filter((term) => idsFromQuizzes.has(term.id));
    if (idsFromQuizzes.has("__unassigned__")) {
      base.push({ id: "__unassigned__", name: "Unassigned" });
    }
    return base;
  })();

  const termMaxScores = new Map(
    displayedTerms.map((term) => {
      const total = quizzesWithTerm
        .filter((quiz) => quiz.termId === term.id)
        .reduce((sum, quiz) => sum + quiz.totalScore, 0);
      return [term.id, total] as const;
    }),
  );

  const totalPossibleScore = quizzesWithTerm.reduce((sum, quiz) => sum + quiz.totalScore, 0);

  const studentRows = (students ?? []).map((student) => {
    const perQuiz = quizzesWithTerm.map((quiz) => {
      const score = (submissions ?? []).find(
        (submission) =>
          submission.quiz_id === quiz.id && submission.student_id === student.student_id,
      )?.score;

      return {
        quizId: quiz.id,
        score: score ?? 0,
        termId: quiz.termId,
      };
    });

    const total = perQuiz.reduce((sum, item) => sum + item.score, 0);
    const termTotals = new Map<string, number>();
    for (const term of displayedTerms) {
      const subtotal = perQuiz
        .filter((item) => item.termId === term.id)
        .reduce((sum, item) => sum + item.score, 0);
      termTotals.set(term.id, subtotal);
    }

    return {
      studentId: student.student_id,
      name: student.student_name || student.profiles[0]?.full_name || "Unnamed Student",
      perQuiz,
      termTotals,
      total,
    };
  });

  const visibleStudentRows =
    profile.role === "student"
      ? studentRows.filter((row) => row.studentId === profile.id)
      : studentRows;

  const classAveragePercent =
    visibleStudentRows.length > 0 && totalPossibleScore > 0 && profile.role !== "student"
      ? visibleStudentRows.reduce((sum, row) => sum + (row.total / totalPossibleScore) * 100, 0) /
        visibleStudentRows.length
      : 0;

  const topPerformerPercent =
    visibleStudentRows.length > 0 && totalPossibleScore > 0 && profile.role !== "student"
      ? Math.max(...visibleStudentRows.map((row) => (row.total / totalPossibleScore) * 100))
      : 0;

  const termMastery = displayedTerms.map((term) => {
    const termMax = termMaxScores.get(term.id) ?? 0;
    const avgPercent =
      visibleStudentRows.length > 0 && termMax > 0 && profile.role !== "student"
        ? visibleStudentRows.reduce((sum, row) => sum + ((row.termTotals.get(term.id) ?? 0) / termMax) * 100, 0) /
          visibleStudentRows.length
        : 0;
    return {
      id: term.id,
      name: term.name,
      avgPercent,
      termMax,
    };
  });

  const weakestTerm =
    termMastery.length > 0
      ? [...termMastery].sort((a, b) => a.avgPercent - b.avgPercent)[0]
      : null;

  const isTeacherOrAdmin = profile.role === "admin" || profile.role === "teacher";

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Class Scoreboard"
      subtitle="Track per-term totals, student ranking, and mastery insights."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex justify-between gap-2">
          <p className="text-sm text-[var(--muted)]">Class: {classData?.name || "Class"}</p>
          <Link href={`/classes/${classId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Back to class
          </Link>
        </div>

        <section className="rounded-2xl border border-cyan-900/30 bg-[linear-gradient(180deg,#041328_0%,#081a3a_100%)] p-4 text-white shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
          {profile.role !== "student" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/70">Class average</p>
                <p className="mt-2 text-3xl font-bold text-cyan-200">{classAveragePercent.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/70">Top performer</p>
                <p className="mt-2 text-3xl font-bold text-emerald-200">{topPerformerPercent.toFixed(1)}%</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/70">Your scores only</p>
              <p className="mt-2 text-sm text-cyan-100/80">You can view only your own test totals below.</p>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#071635]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0a224e] text-left text-cyan-100/70">
              <tr>
                <th className="px-3 py-2">Student</th>
                {displayedTerms.map((term) => (
                  <th key={term.id} className="px-3 py-2">{term.name} total</th>
                ))}
                <th className="px-3 py-2">Overall total</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudentRows.map((row) => (
                <tr key={row.studentId} className="border-t border-white/10">
                  <td className="px-3 py-2 font-medium text-white">{row.name}</td>
                  {displayedTerms.map((term) => {
                    const score = row.termTotals.get(term.id) ?? 0;
                    const max = termMaxScores.get(term.id) ?? 0;
                    return (
                      <td key={term.id} className="px-3 py-2 text-cyan-100/85">
                        {score}
                        <span className="ml-1 text-xs text-cyan-200/55">/ {max}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 font-semibold text-emerald-200">
                    {row.total}
                    <span className="ml-1 text-xs text-emerald-200/65">/ {totalPossibleScore}</span>
                  </td>
                </tr>
              ))}

              {visibleStudentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayedTerms.length + 2}
                    className="px-3 py-4 text-center text-cyan-100/70"
                  >
                    {profile.role === "student" ? "No personal scoreboard data yet." : "No scoreboard data yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

          {profile.role !== "student" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-[#0a1f47] p-4">
              <h3 className="text-lg font-semibold text-white">Subject Mastery</h3>
              {weakestTerm ? (
                <p className="mt-2 text-sm text-cyan-100/85">
                  {weakestTerm.name} has the lowest class mastery at {weakestTerm.avgPercent.toFixed(1)}%. Consider adding a review session.
                </p>
              ) : (
                <p className="mt-2 text-sm text-cyan-100/85">No term performance data yet.</p>
              )}
              <div className="mt-3">
                <Link
                  href={`/classes/${classId}/announcements`}
                  className="inline-flex rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
                >
                  Schedule review session
                </Link>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1f47] p-4">
              <h3 className="text-lg font-semibold text-white">Visual Reference</h3>
              <div className="mt-3 space-y-3">
                {termMastery.map((term) => (
                  <div key={term.id}>
                    <div className="flex items-center justify-between text-xs text-cyan-100/80">
                      <span>{term.name}</span>
                      <span>{term.avgPercent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                        style={{ width: `${Math.max(0, Math.min(100, term.avgPercent))}%` }}
                      />
                    </div>
                  </div>
                ))}

                {termMastery.length === 0 ? (
                  <p className="text-sm text-cyan-100/70">No terms to visualize yet.</p>
                ) : null}
              </div>
            </article>
            </div>
          ) : null}
        </section>



        {!isTeacherOrAdmin ? (
          <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
            Student view: You can compare your test scores here.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
