import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const quizId = String(body.quizId ?? "").trim();
  const allowAutoScore =
    body.allowAutoScore === undefined ? undefined : Boolean(body.allowAutoScore);
  const allowReview =
    body.allowReview === undefined ? undefined : Boolean(body.allowReview);

  if (!quizId) {
    return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
  }

  if (allowAutoScore === undefined && allowReview === undefined) {
    return NextResponse.json(
      { error: "At least one visibility option is required." },
      { status: 400 },
    );
  }

  const { data: quiz } = await auth.supabase
    .from("quizzes")
    .select("id, class_id")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const { data: classData } = await auth.supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", quiz.class_id)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (auth.profile.role !== "admin" && classData.teacher_id !== auth.profile.id) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const updates: { allow_auto_score?: boolean; allow_review?: boolean } = {};
  if (allowAutoScore !== undefined) {
    updates.allow_auto_score = allowAutoScore;
  }
  if (allowReview !== undefined) {
    updates.allow_review = allowReview;
  }

  const { error } = await auth.supabase
    .from("quizzes")
    .update(updates)
    .eq("id", quizId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Quiz visibility updated." });
}
