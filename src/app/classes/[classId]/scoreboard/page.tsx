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

  const [{ data: quizzes }, { data: students }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, total_score")
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

  const studentRows = (students ?? []).map((student) => {
    const perQuiz = (quizzes ?? []).map((quiz) => {
      const score = (submissions ?? []).find(
        (submission) =>
          submission.quiz_id === quiz.id && submission.student_id === student.student_id,
      )?.score;

      return {
        quizId: quiz.id,
        score: score ?? 0,
      };
    });

    const total = perQuiz.reduce((sum, item) => sum + item.score, 0);

    return {
      studentId: student.student_id,
      name: student.student_name || student.profiles[0]?.full_name || "Unnamed Student",
      perQuiz,
      total,
    };
  });

  const isTeacherOrAdmin = profile.role === "admin" || profile.role === "teacher";

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Class Scoreboard"
      subtitle="Track test results and overall totals per student."
    >
      <div className="app-enter mx-auto w-full max-w-6xl space-y-4">
        <div className="flex justify-end">
          <Link href={`/classes/${classId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Back to class
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Student</th>
                {(quizzes ?? []).map((quiz) => (
                  <th key={quiz.id} className="px-3 py-2">
                    {quiz.title}
                  </th>
                ))}
                <th className="px-3 py-2">Overall total</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((row) => (
                <tr key={row.studentId} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">{row.name}</td>
                  {row.perQuiz.map((item) => (
                    <td key={item.quizId} className="px-3 py-2 text-[var(--muted)]">
                      {item.score}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.total}</td>
                </tr>
              ))}

              {studentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(quizzes?.length ?? 0) + 2}
                    className="px-3 py-4 text-center text-[var(--muted)]"
                  >
                    No scoreboard data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {!isTeacherOrAdmin ? (
          <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
            Student view: You can compare your test scores here.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
