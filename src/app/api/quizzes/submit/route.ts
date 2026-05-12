import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";
import { getCurrentWallClockValue, toStoredWallClockValue } from "@/lib/date-utils";

type AnswerPayload = {
  questionId: string;
  answer: string;
};

function parseCheckboxAnswer(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [] as string[];
  }
}

function parseExpectedAnswers(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Treat as single text answer.
  }

  return [trimmed];
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "student") {
    return NextResponse.json({ error: "Only students can submit quizzes." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();
  const answers = Array.isArray(body.answers) ? (body.answers as AnswerPayload[]) : [];
  const password = String(body.password ?? "").trim();
  const remainingSeconds = Number(body.remainingSeconds ?? 0);

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const { data: quiz } = await auth.supabase
    .from("quizzes")
    .select("id, class_id, allow_auto_score, opens_at, closes_at, quiz_password")
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

  const now = getCurrentWallClockValue();
  const opensAt = quiz.opens_at ? toStoredWallClockValue(quiz.opens_at) : null;
  const closesAt = quiz.closes_at ? toStoredWallClockValue(quiz.closes_at) : null;

  const { data: existingSubmission } = await auth.supabase
    .from("submissions")
    .select("id, status")
    .eq("quiz_id", quizId)
    .eq("student_id", auth.profile.id)
    .maybeSingle();

  if (existingSubmission && existingSubmission.status !== "in_progress") {
    return NextResponse.json({ error: "Quiz is already submitted." }, { status: 409 });
  }

  if (!existingSubmission) {
    if (opensAt && now < opensAt) {
      return NextResponse.json({ error: "Quiz is not open yet." }, { status: 403 });
    }

    if (closesAt && now > closesAt) {
      return NextResponse.json(
        { error: "Quiz closed. Late submissions are not accepted." },
        { status: 403 },
      );
    }

    if (quiz.quiz_password && password !== quiz.quiz_password) {
      return NextResponse.json({ error: "Invalid quiz password." }, { status: 403 });
    }
  }

  const { data: questions, error: questionError } = await auth.supabase
    .from("questions")
    .select("id, type, correct_answer, points, required")
    .eq("quiz_id", quizId);

  if (questionError || !questions) {
    return NextResponse.json(
      { error: questionError?.message || "Unable to load quiz questions." },
      { status: 500 },
    );
  }

  const answerMap = new Map(answers.map((entry) => [entry.questionId, String(entry.answer || "")]));

  for (const question of questions) {
    if (!question.required) {
      continue;
    }

    const response = String(answerMap.get(question.id) || "");
    if (question.type === "checkbox") {
      if (parseCheckboxAnswer(response).length === 0) {
        return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
      }
      continue;
    }

    if (response.trim().length === 0) {
      return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
    }
  }

  let score = 0;
  for (const question of questions) {
    const rawResponse = String(answerMap.get(question.id) || "");
    const expected = String(question.correct_answer || "");

    if (question.type === "essay") {
      continue;
    }

    if (question.type === "checkbox") {
      const expectedValues = parseCheckboxAnswer(expected).map((value) => value.toLowerCase()).sort();
      const responseValues = parseCheckboxAnswer(rawResponse).map((value) => value.toLowerCase()).sort();

      if (
        expectedValues.length > 0 &&
        expectedValues.length === responseValues.length &&
        expectedValues.every((value, index) => value === responseValues[index])
      ) {
        score += Number(question.points || 1);
      }

      continue;
    }

    const normalizedResponse = rawResponse.trim().toLowerCase();
    const normalizedExpectedCandidates = parseExpectedAnswers(expected).map((value) => value.toLowerCase());

    if (
      normalizedResponse &&
      normalizedExpectedCandidates.length > 0 &&
      normalizedExpectedCandidates.includes(normalizedResponse)
    ) {
      score += Number(question.points || 1);
    }
  }

  const { error } = await auth.supabase.from("submissions").upsert(
    {
      quiz_id: quizId,
      student_id: auth.profile.id,
      answers,
      score: quiz.allow_auto_score ? score : 0,
      status: quiz.allow_auto_score ? "graded" : "ungraded",
      remaining_seconds: Math.max(0, remainingSeconds),
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "quiz_id,student_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ score: quiz.allow_auto_score ? score : null });
}
