import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { QuizReviewClient } from "./view";

export default async function QuizReviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await requireProfile();

  if (profile.role === "student") {
    notFound();
  }

  return (
    <AppShell
      name={profile.full_name || "User"}
      role={profile.role}
      title="Test Submission Review"
      subtitle="Review answers and adjust scores for manual grading."
    >
      <div className="mx-auto w-full max-w-6xl">
        <QuizReviewClient quizId={quizId} />
      </div>
    </AppShell>
  );
}
