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

  const { data: membership } = await supabase
    .from("class_students")
    .select("member_role")
    .eq("class_id", quiz.class_id)
    .eq("student_id", userId)
    .maybeSingle();

  return {
    allowed: classData?.teacher_id === userId || membership?.member_role === "teacher",
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

  const studentIds = Array.from(
    new Set((submissions ?? []).map((submission) => submission.student_id).filter(Boolean)),
  );

  const { data: classStudents } = studentIds.length > 0
    ? await auth.supabase
        .from("class_students")
        .select("student_id, student_name, profiles(full_name)")
        .eq("class_id", permission.quiz.class_id)
        .in("student_id", studentIds)
    : { data: [] as Array<{ student_id: string; student_name: string | null; profiles?: { full_name: string | null }[] }> };

  const studentNameMap = new Map(
    (classStudents ?? []).map((entry) => [
      entry.student_id,
      entry.student_name || entry.profiles?.[0]?.full_name || null,
    ] as const),
  );

  const submissionsWithNames = (submissions ?? []).map((submission) => ({
    ...submission,
    student_name: studentNameMap.get(submission.student_id) || submission.profiles?.[0]?.full_name || null,
  }));

  return NextResponse.json({
    quiz: permission.quiz,
    questions: questions ?? [],
    submissions: submissionsWithNames,
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
  const questionScores =
    body.questionScores && typeof body.questionScores === "object" && !Array.isArray(body.questionScores)
      ? (body.questionScores as Record<string, number>)
      : null;

  if (!submissionId || Number.isNaN(score)) {
    return NextResponse.json(
      { error: "Submission ID and valid score are required." },
      { status: 400 },
    );
  }

  const { data: submission } = await auth.supabase
    .from("submissions")
    .select("id, quiz_id, answers")
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

  let nextScore = Math.max(0, Math.round(score));
  let nextAnswers = submission.answers;

  if (questionScores) {
    const { data: questions } = await auth.supabase
      .from("questions")
      .select("id, points")
      .eq("quiz_id", submission.quiz_id);

    const maxByQuestion = new Map((questions ?? []).map((q) => [q.id, Number(q.points ?? 1)] as const));

    const existingAnswers = Array.isArray(submission.answers)
      ? (submission.answers as Array<{ questionId: string; answer: string; awardedPoints?: number }>)
      : [];

    nextAnswers = existingAnswers.map((entry) => {
      const maxPoints = Math.max(0, Number(maxByQuestion.get(entry.questionId) ?? 0));
      const raw = Number(questionScores[entry.questionId] ?? 0);
      const awardedPoints = Math.max(0, Math.min(maxPoints, Number.isFinite(raw) ? raw : 0));
      return {
        ...entry,
        awardedPoints,
      };
    });

    nextScore = (nextAnswers as Array<{ awardedPoints?: number }>).reduce(
      (sum, entry) => sum + Number(entry.awardedPoints ?? 0),
      0,
    );
  }

  const { error } = await auth.supabase
    .from("submissions")
    .update({ score: Math.max(0, Math.round(nextScore)), status: normalizedStatus, answers: nextAnswers })
    .eq("id", submissionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Submission score updated." });
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const submissionId = String(body.submissionId ?? "").trim();
  const action = String(body.action ?? "").trim();

  if (!submissionId || action !== "return") {
    return NextResponse.json(
      { error: "Submission ID and action are required." },
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

  // Delete the submission so the student can retake the quiz
  const { error } = await auth.supabase
    .from("submissions")
    .delete()
    .eq("id", submissionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Submission returned to student. They can now retake the quiz." });
}
