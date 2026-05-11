import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QuizClient } from "./view";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: quiz }, { data: questions }, { data: existingSubmission }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, duration, class_id, total_score, allow_review, opens_at, closes_at, quiz_password")
      .eq("id", quizId)
      .single(),
    supabase
      .from("questions")
      .select("id, type, content, options, points, correct_answer, image_url, required, option_feedback")
      .eq("quiz_id", quizId),
    supabase
      .from("submissions")
      .select("id, score, status, submitted_at, answers, remaining_seconds")
      .eq("quiz_id", quizId)
      .eq("student_id", profile.id)
      .maybeSingle(),
  ]);

  if (!quiz) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("class_students")
    .select("id, member_role")
    .eq("class_id", quiz.class_id)
    .eq("student_id", profile.id)
    .maybeSingle();

  const { data: classData } = await supabase
    .from("classes")
    .select("teacher_id, name")
    .eq("id", quiz.class_id)
    .single();

  const canViewAsTeacher =
    Boolean(classData) &&
    (classData?.teacher_id === profile.id || profile.role === "admin" || membership?.member_role === "teacher");
  const canTakeQuiz = Boolean(membership) && profile.role === "student";

  if (!canTakeQuiz && !canViewAsTeacher) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          You are not allowed to access this test.
        </p>
      </div>
    );
  }

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title={quiz.title}
      subtitle="Test workspace"
    >
      <div className="app-enter mx-auto w-full max-w-4xl">
        <QuizClient
          classId={quiz.class_id}
          className={classData?.name ?? "Class"}
          quizId={quiz.id}
          title={quiz.title}
          duration={quiz.duration || 15}
          totalScore={quiz.total_score}
          isStudent={canTakeQuiz}
          allowReview={Boolean(quiz.allow_review)}
          opensAt={quiz.opens_at}
          closesAt={quiz.closes_at}
          hasPassword={Boolean(quiz.quiz_password)}
          existingSubmission={existingSubmission}
          questions={(questions ?? []).map((question) => ({
            id: question.id,
            type: question.type,
            content: question.content || "",
            imageUrl: question.image_url || "",
            options: Array.isArray(question.options)
              ? (question.options as string[])
              : [],
            required: question.required ?? true,
            optionFeedback:
              question.option_feedback &&
              typeof question.option_feedback === "object" &&
              !Array.isArray(question.option_feedback)
                ? (question.option_feedback as Record<string, string>)
                : {},
            points: question.points || 1,
            correctAnswer: question.correct_answer || "",
          }))}
        />
      </div>
    </AppShell>
  );
}
