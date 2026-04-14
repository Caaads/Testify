import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreateQuizClient } from "../../create/view";

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: classData }, { data: terms }, { data: quiz }, { data: questions }] = await Promise.all([
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
      .from("quizzes")
      .select("id, title, term_id, duration, allow_auto_score, allow_review, quiz_password, opens_at, closes_at, class_id")
      .eq("id", quizId)
      .single(),
    supabase
      .from("questions")
      .select("id, content, options, correct_answer, points")
      .eq("quiz_id", quizId)
      .order("id", { ascending: true }),
  ]);

  if (!classData || !quiz || quiz.class_id !== classId) {
    notFound();
  }

  const canManage = profile.role === "admin" || classData.teacher_id === profile.id;
  if (!canManage) {
    notFound();
  }

  const initialQuestions = (questions ?? []).map((question) => {
    const options = Array.isArray(question.options) ? (question.options as string[]) : [];

    return {
      content: question.content || "",
      optionA: options[0] || "",
      optionB: options[1] || "",
      optionC: options[2] || "",
      optionD: options[3] || "",
      correctAnswer: question.correct_answer || "",
      points: question.points || 1,
    };
  });

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Edit Test"
      subtitle={`Class: ${classData.name}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <CreateQuizClient
          classId={classId}
          terms={terms ?? []}
          mode="edit"
          quiz={{
            id: quiz.id,
            title: quiz.title,
            term_id: quiz.term_id,
            duration: quiz.duration,
            allow_auto_score: quiz.allow_auto_score,
            allow_review: quiz.allow_review,
            quiz_password: quiz.quiz_password,
            opens_at: quiz.opens_at,
            closes_at: quiz.closes_at,
          }}
          initialQuestions={initialQuestions}
        />
      </div>
    </AppShell>
  );
}