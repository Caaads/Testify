import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreateQuizClient } from "../../create/view";
import type { BuilderQuestionType, QuizQuestion } from "../../create/view";

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
      .select("id, type, content, options, correct_answer, image_url, required, option_feedback, points")
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

  const initialQuestions: QuizQuestion[] = (questions ?? []).map((question) => {
    const options = Array.isArray(question.options) ? (question.options as string[]) : [];
    const optionFeedbackMap =
      question.option_feedback && typeof question.option_feedback === "object" && !Array.isArray(question.option_feedback)
        ? (question.option_feedback as Record<string, string>)
        : {};
    const parsedAnswerKeys = (() => {
      try {
        const parsed = JSON.parse(question.correct_answer || "[]");
        return Array.isArray(parsed)
          ? parsed.map((value) => String(value)).filter(Boolean)
          : [];
      } catch {
        return [] as string[];
      }
    })();

    const type: BuilderQuestionType = (() => {
      const nextType = String(question.type || "mcq");
      if (
        nextType === "mcq" ||
        nextType === "checkbox" ||
        nextType === "dropdown" ||
        nextType === "identification" ||
        nextType === "essay"
      ) {
        return nextType as BuilderQuestionType;
      }
      return "mcq";
    })();

    return {
      content: question.content || "",
      type,
      imageUrl: question.image_url || "",
      options:
        type === "mcq" || type === "checkbox" || type === "dropdown"
          ? options.length >= 2
            ? options
            : ["", ""]
          : [],
      optionFeedbacks:
        type === "mcq" || type === "checkbox" || type === "dropdown"
          ? (options.length >= 2 ? options : ["", ""]).map((option) => optionFeedbackMap[option] || "")
          : [],
      correctAnswers:
        type === "mcq" || type === "checkbox" || type === "dropdown" || type === "identification"
          ? (parsedAnswerKeys.length > 0 ? parsedAnswerKeys : question.correct_answer ? [question.correct_answer] : [])
          : [],
      required: question.required ?? true,
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