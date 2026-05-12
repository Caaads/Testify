import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";
import { toStoredWallClockValue } from "@/lib/date-utils";

type IncomingQuestion = {
  type: "mcq" | "checkbox" | "dropdown" | "identification" | "essay";
  content: string;
  imageUrl?: string;
  options: string[];
  optionFeedback?: Record<string, string>;
  correctAnswer: string;
  correctAnswers?: string[];
  required?: boolean;
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

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function isOptionType(type: IncomingQuestion["type"]) {
  return type === "mcq" || type === "checkbox" || type === "dropdown";
}

function normalizeCorrectAnswer(question: IncomingQuestion) {
  if (question.type === "mcq" || question.type === "dropdown") {
    const selected = normalizeStringArray(question.correctAnswers);
    if (selected.length > 1) {
      return JSON.stringify([...new Set(selected)]);
    }

    return selected[0] || normalizeString(question.correctAnswer);
  }

  if (question.type === "checkbox") {
    const selected = normalizeStringArray(question.correctAnswers);
    return JSON.stringify([...new Set(selected)]);
  }

  if (question.type === "identification") {
    const listed = normalizeStringArray(question.correctAnswers);
    const fallback = normalizeString(question.correctAnswer)
      .split(/\r?\n|,|\|\|/)
      .map((value) => value.trim())
      .filter(Boolean);
    const candidates = [...new Set(listed.length > 0 ? listed : fallback)];

    return candidates.length > 0 ? JSON.stringify(candidates) : "";
  }

  if (question.type === "essay") {
    return "";
  }

  return normalizeString(question.correctAnswer);
}

function normalizeOptionFeedback(question: IncomingQuestion) {
  if (!isOptionType(question.type)) {
    return null;
  }

  const options = normalizeStringArray(question.options);
  const feedback = question.optionFeedback && typeof question.optionFeedback === "object"
    ? question.optionFeedback
    : {};

  const entries = options
    .map((option) => {
      const nextFeedback = normalizeString(feedback[option]);
      return [option, nextFeedback] as const;
    })
    .filter(([, value]) => value.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function validateQuestion(question: IncomingQuestion) {
  const type = question.type;
  const content = normalizeString(question.content);
  const imageUrl = normalizeString(question.imageUrl);
  const options = normalizeStringArray(question.options);
  const correctAnswer = normalizeString(question.correctAnswer);
  const correctAnswers = normalizeStringArray(question.correctAnswers);

  if (!content && !imageUrl) {
    return "Each question needs text or an image.";
  }

  if (isOptionType(type) && options.length < 2) {
    return "Option-based questions must have at least two options.";
  }

  if (type === "mcq" || type === "dropdown") {
    const selected = correctAnswers.length > 0 ? correctAnswers : (correctAnswer ? [correctAnswer] : []);
    if (selected.length === 0) {
      return "At least one answer key must be selected from the question options.";
    }

    if (selected.some((value) => !options.includes(value))) {
      return "Answer keys must be selected from the question options.";
    }
  }

  if (type === "checkbox") {
    if (correctAnswers.length === 0) {
      return "Checkbox questions require at least one correct answer key.";
    }

    if (correctAnswers.some((value) => !options.includes(value))) {
      return "Checkbox answer keys must come from the question options.";
    }
  }

  if (type === "identification" && !correctAnswer) {
    const alternatives = normalizeStringArray(question.correctAnswers);
    if (alternatives.length === 0) {
      return "Identification questions require an answer key.";
    }
  }

  return null;
}

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

  const opensAt = opensAtRaw ? toStoredWallClockValue(opensAtRaw) : null;
  const closesAt = closesAtRaw ? toStoredWallClockValue(closesAtRaw) : null;

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

  for (const question of questions) {
    const validationError = validateQuestion(question);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

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
      opens_at: opensAt,
      closes_at: closesAt,
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
    type: question.type,
    content: normalizeString(question.content) || null,
    image_url: normalizeString(question.imageUrl) || null,
    options: isOptionType(question.type) ? normalizeStringArray(question.options) : null,
    option_feedback: normalizeOptionFeedback(question),
    correct_answer: normalizeCorrectAnswer(question),
    required: Boolean(question.required ?? true),
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

  for (const question of questions) {
    const validationError = validateQuestion(question);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

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
      opens_at: opensAt,
      closes_at: closesAt,
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
    type: question.type,
    content: normalizeString(question.content) || null,
    image_url: normalizeString(question.imageUrl) || null,
    options: isOptionType(question.type) ? normalizeStringArray(question.options) : null,
    option_feedback: normalizeOptionFeedback(question),
    correct_answer: normalizeCorrectAnswer(question),
    required: Boolean(question.required ?? true),
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
