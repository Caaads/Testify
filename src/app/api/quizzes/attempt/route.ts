import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";
import { getCurrentWallClockValue, toStoredWallClockValue } from "@/lib/date-utils";

type AttemptAnswer = {
  questionId: string;
  answer: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "student") {
    return NextResponse.json({ error: "Only students can start attempts." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const { data: quiz } = await auth.supabase
    .from("quizzes")
    .select("id, class_id, duration, opens_at, closes_at, quiz_password")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const { data: classMember } = await auth.supabase
    .from("class_students")
    .select("id")
    .eq("class_id", quiz.class_id)
    .eq("student_id", auth.profile.id)
    .maybeSingle();

  if (!classMember) {
    return NextResponse.json({ error: "You are not a member of this class." }, { status: 403 });
  }

  const { data: existing } = await auth.supabase
    .from("submissions")
    .select("id, status, answers, remaining_seconds, score")
    .eq("quiz_id", quizId)
    .eq("student_id", auth.profile.id)
    .maybeSingle();

  if (existing && existing.status !== "in_progress") {
    return NextResponse.json({
      alreadySubmitted: true,
      score: existing.score,
      status: existing.status,
      answers: Array.isArray(existing.answers) ? existing.answers : [],
    });
  }

  const now = getCurrentWallClockValue();
  const opensAt = quiz.opens_at ? toStoredWallClockValue(quiz.opens_at) : null;
  const closesAt = quiz.closes_at ? toStoredWallClockValue(quiz.closes_at) : null;

  if (!existing) {
    if (opensAt && now < opensAt) {
      return NextResponse.json({ error: "Quiz is not open yet." }, { status: 403 });
    }

    if (closesAt && now > closesAt) {
      return NextResponse.json(
        { error: "Quiz has already closed and does not accept new attempts." },
        { status: 403 },
      );
    }

    if (quiz.quiz_password && password.length === 0) {
      return NextResponse.json(
        { error: "Quiz password is required.", requiresPassword: true },
        { status: 401 },
      );
    }

    if (quiz.quiz_password && password !== quiz.quiz_password) {
      return NextResponse.json({ error: "Incorrect quiz password." }, { status: 403 });
    }

    const remainingSeconds = Math.max(60, Number(quiz.duration ?? 15) * 60);

    const { error: insertError } = await auth.supabase.from("submissions").insert({
      quiz_id: quizId,
      student_id: auth.profile.id,
      status: "in_progress",
      score: 0,
      answers: [],
      remaining_seconds: remainingSeconds,
      started_at: nowIso(),
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "in_progress",
      remainingSeconds,
      answers: [],
    });
  }

  return NextResponse.json({
    status: "in_progress",
    remainingSeconds: Math.max(0, Number(existing.remaining_seconds ?? 0)),
    answers: Array.isArray(existing.answers) ? existing.answers : [],
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "student") {
    return NextResponse.json({ error: "Only students can update attempts." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();
  const answers = Array.isArray(body.answers) ? (body.answers as AttemptAnswer[]) : [];
  const remainingSeconds = Number(body.remainingSeconds ?? 0);

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("submissions")
    .update({
      answers,
      remaining_seconds: Math.max(0, remainingSeconds),
    })
    .eq("quiz_id", quizId)
    .eq("student_id", auth.profile.id)
    .eq("status", "in_progress");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
