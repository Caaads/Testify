import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";

type IncomingQuestion = {
  content: string;
  options: string[];
  correctAnswer: string;
  points: number;
};

type QuizPayload = {
  classId: string;
  termId: string;
  title: string;
  duration: number;
  allowAutoScore: boolean;
  allowReview: boolean;
  quizPassword: string;
  opensAt: string;
  closesAt: string;
  questions: IncomingQuestion[];
};

async function authorizeClassManager(auth: { profile: any; supabase: any }, classId: string) {
  const [{ data: classData }, { data: membership }] = await Promise.all([
    auth.supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classId)
      .single(),
    auth.supabase
      .from("class_students")
      .select("member_role")
      .eq("class_id", classId)
      .eq("student_id", auth.profile.id)
      .maybeSingle(),
  ]);

  if (!classData) {
    return { error: NextResponse.json({ error: "Class not found." }, { status: 404 }) };
  }

  const isTeacherMemberManager = membership?.member_role === "teacher";
  if (auth.profile.role !== "admin" && classData.teacher_id !== auth.profile.id && !isTeacherMemberManager) {
    return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  }

  return { classData };
}

async function buildQuizPayload(body: unknown) {
  const payload = body as Partial<QuizPayload>;
  const classId = String(payload.classId ?? "").trim();
  const termId = String(payload.termId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const duration = Number(payload.duration ?? 15);
  const allowAutoScore = Boolean(payload.allowAutoScore ?? true);
  const allowReview = Boolean(payload.allowReview ?? false);
  const quizPassword = String(payload.quizPassword ?? "").trim();
  const opensAtRaw = String(payload.opensAt ?? "").trim();
  const closesAtRaw = String(payload.closesAt ?? "").trim();
  const questions = Array.isArray(payload.questions)
    ? (payload.questions as IncomingQuestion[])
    : [];

  const opensAt = opensAtRaw ? new Date(opensAtRaw) : null;
  const closesAt = closesAtRaw ? new Date(closesAtRaw) : null;

  return {
    classId,
    termId,
    title,
    duration,
    allowAutoScore,
    allowReview,
    quizPassword,
    opensAt,
    closesAt,
    questions,
  };
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const {
    classId,
    termId,
    title,
    duration,
    allowAutoScore,
    allowReview,
    quizPassword,
    opensAt,
    closesAt,
    questions,
  } = await buildQuizPayload(body);

  if (!classId || !termId || !title || questions.length === 0) {
    return NextResponse.json(
      { error: "Class, term, title, and questions are required." },
      { status: 400 },
    );
  }

  if ((opensAt && Number.isNaN(opensAt.getTime())) || (closesAt && Number.isNaN(closesAt.getTime()))) {
    return NextResponse.json({ error: "Invalid schedule date/time." }, { status: 400 });
  }

  if (opensAt && closesAt && closesAt <= opensAt) {
    return NextResponse.json(
      { error: "Close time must be after open time." },
      { status: 400 },
    );
  }

  const authorization = await authorizeClassManager(auth, classId);
  if ("error" in authorization) {
    return authorization.error;
  }

  const totalScore = questions.reduce((sum, q) => sum + Math.max(1, Number(q.points || 1)), 0);

  const { data: quiz, error: quizError } = await auth.supabase
    .from("quizzes")
    .insert({
      class_id: classId,
      term_id: termId,
      title,
      duration,
      total_score: totalScore,
      allow_auto_score: allowAutoScore,
      allow_review: allowReview,
      quiz_password: quizPassword || null,
      opens_at: opensAt ? opensAt.toISOString() : null,
      closes_at: closesAt ? closesAt.toISOString() : null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();

  if (quizError || !quiz) {
    return NextResponse.json(
      { error: quizError?.message || "Unable to create quiz." },
      { status: 500 },
    );
  }

  const normalizedQuestions = questions.map((question) => ({
    quiz_id: quiz.id,
    type: "mcq" as const,
    content: String(question.content || "").trim(),
    options: question.options,
    correct_answer: String(question.correctAnswer || "").trim(),
    points: Math.max(1, Number(question.points || 1)),
  }));

  const { error: questionsError } = await auth.supabase
    .from("questions")
    .insert(normalizedQuestions);

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({ quizId: quiz.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const {
    classId,
    termId,
    title,
    duration,
    allowAutoScore,
    allowReview,
    quizPassword,
    opensAt,
    closesAt,
    questions,
  } = await buildQuizPayload(body);

  if (!classId || !termId || !title || questions.length === 0) {
    return NextResponse.json(
      { error: "Class, term, title, and questions are required." },
      { status: 400 },
    );
  }

  if ((opensAt && Number.isNaN(opensAt.getTime())) || (closesAt && Number.isNaN(closesAt.getTime()))) {
    return NextResponse.json({ error: "Invalid schedule date/time." }, { status: 400 });
  }

  if (opensAt && closesAt && closesAt <= opensAt) {
    return NextResponse.json(
      { error: "Close time must be after open time." },
      { status: 400 },
    );
  }

  const authorization = await authorizeClassManager(auth, classId);
  if ("error" in authorization) {
    return authorization.error;
  }

  const { data: existingQuiz } = await auth.supabase
    .from("quizzes")
    .select("id, class_id")
    .eq("id", quizId)
    .maybeSingle();

  if (!existingQuiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  if (existingQuiz.class_id !== classId) {
    return NextResponse.json({ error: "Quiz does not belong to the selected class." }, { status: 400 });
  }

  const totalScore = questions.reduce((sum, q) => sum + Math.max(1, Number(q.points || 1)), 0);

  const { error: quizError } = await auth.supabase
    .from("quizzes")
    .update({
      term_id: termId,
      title,
      duration,
      total_score: totalScore,
      allow_auto_score: allowAutoScore,
      allow_review: allowReview,
      quiz_password: quizPassword || null,
      opens_at: opensAt ? opensAt.toISOString() : null,
      closes_at: closesAt ? closesAt.toISOString() : null,
    })
    .eq("id", quizId);

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }

  const { error: deleteError } = await auth.supabase
    .from("questions")
    .delete()
    .eq("quiz_id", quizId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const normalizedQuestions = questions.map((question) => ({
    quiz_id: quizId,
    type: "mcq" as const,
    content: String(question.content || "").trim(),
    options: question.options,
    correct_answer: String(question.correctAnswer || "").trim(),
    points: Math.max(1, Number(question.points || 1)),
  }));

  const { error: questionsError } = await auth.supabase
    .from("questions")
    .insert(normalizedQuestions);

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Quiz updated.", quizId }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  const { data: quiz } = await auth.supabase
    .from("quizzes")
    .select("id, class_id")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const authorization = await authorizeClassManager(auth, quiz.class_id);
  if ("error" in authorization) {
    return authorization.error;
  }

  const { error } = await auth.supabase.from("quizzes").delete().eq("id", quizId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Quiz deleted." }, { status: 200 });
}
