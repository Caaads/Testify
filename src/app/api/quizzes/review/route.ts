import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

async function canManageQuiz(
  supabase: SupabaseClient,
  quizId: string,
  userId: string,
  role: "student" | "teacher" | "admin",
) {
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, class_id, title")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return { allowed: false as const, quiz: null };
  }

  if (role === "admin") {
    return { allowed: true as const, quiz };
  }

  const { data: classData } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", quiz.class_id)
    .single();

  return {
    allowed: classData?.teacher_id === userId,
    quiz,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const quizId = request.nextUrl.searchParams.get("quizId")?.trim();
  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const permission = await canManageQuiz(
    auth.supabase,
    quizId,
    auth.profile.id,
    auth.profile.role,
  );

  if (!permission.quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  if (!permission.allowed) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const [{ data: questions }, { data: submissions, error: submissionsError }] = await Promise.all([
    auth.supabase
      .from("questions")
      .select("id, content, correct_answer, points, type")
      .eq("quiz_id", quizId)
      .order("id", { ascending: true }),
    auth.supabase
      .from("submissions")
      .select("id, student_id, score, status, answers, submitted_at, profiles(full_name)")
      .eq("quiz_id", quizId)
      .order("submitted_at", { ascending: true }),
  ]);

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  return NextResponse.json({
    quiz: permission.quiz,
    questions: questions ?? [],
    submissions: submissions ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const submissionId = String(body.submissionId ?? "").trim();
  const score = Number(body.score ?? 0);
  const status = String(body.status ?? "graded").trim();

  if (!submissionId || Number.isNaN(score)) {
    return NextResponse.json(
      { error: "Submission ID and valid score are required." },
      { status: 400 },
    );
  }

  const { data: submission } = await auth.supabase
    .from("submissions")
    .select("id, quiz_id")
    .eq("id", submissionId)
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const permission = await canManageQuiz(
    auth.supabase,
    submission.quiz_id,
    auth.profile.id,
    auth.profile.role,
  );

  if (!permission.allowed) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const normalizedStatus = status === "ungraded" ? "ungraded" : "graded";

  const { error } = await auth.supabase
    .from("submissions")
    .update({ score: Math.max(0, Math.round(score)), status: normalizedStatus })
    .eq("id", submissionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Submission score updated." });
}
