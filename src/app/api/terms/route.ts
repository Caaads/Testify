import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

async function hasClassManageAccess(auth: { profile: any; supabase: any }, classId: string) {
  if (auth.profile.role === "admin") {
    return true;
  }

  const [{ data: classData }, { data: membership }] = await Promise.all([
    auth.supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle(),
    auth.supabase
      .from("class_students")
      .select("member_role")
      .eq("class_id", classId)
      .eq("student_id", auth.profile.id)
      .maybeSingle(),
  ]);

  if (!classData) {
    return false;
  }

  return classData.teacher_id === auth.profile.id || membership?.member_role === "teacher";
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();
  const name = String(body.name ?? "").trim();

  if (!classId || !name) {
    return NextResponse.json(
      { error: "Class ID and term name are required." },
      { status: 400 },
    );
  }

  const hasAccess = await hasClassManageAccess(auth, classId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("terms")
    .insert({ class_id: classId, name })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ termId: data.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const termId = String(body.termId ?? "").trim();
  const name = String(body.name ?? "").trim();

  if (!termId || !name) {
    return NextResponse.json(
      { error: "Term ID and term name are required." },
      { status: 400 },
    );
  }

  const { data: termData } = await auth.supabase
    .from("terms")
    .select("id, class_id")
    .eq("id", termId)
    .single();

  if (!termData) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }

  const hasAccess = await hasClassManageAccess(auth, termData.class_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("terms")
    .update({ name })
    .eq("id", termId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Term updated." }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const termId = String(body.termId ?? "").trim();

  if (!termId) {
    return NextResponse.json({ error: "Term ID is required." }, { status: 400 });
  }

  const { data: termData } = await auth.supabase
    .from("terms")
    .select("id, class_id")
    .eq("id", termId)
    .single();

  if (!termData) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }

  const hasAccess = await hasClassManageAccess(auth, termData.class_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("terms")
    .delete()
    .eq("id", termId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Term deleted." }, { status: 200 });
}
