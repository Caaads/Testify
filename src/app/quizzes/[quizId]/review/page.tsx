import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QuizReviewClient } from "./view";

export default async function QuizReviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, class_id, title")
    .eq("id", quizId)
    .single();

  if (profile.role === "student") {
    notFound();
  }

  if (!quiz) {
    notFound();
  }

  const { data: classData } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", quiz.class_id)
    .single();

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Test Submission Review"
      subtitle="Review answers and adjust scores for manual grading."
    >
      <div className="mx-auto w-full max-w-6xl">
        <QuizReviewClient quizId={quizId} classId={quiz.class_id} className={classData?.name || "Class"} />
      </div>
    </AppShell>
  );
}
