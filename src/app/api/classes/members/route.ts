import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

export async function DELETE(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();
  const studentId = String(body.studentId ?? auth.profile.id).trim();

  if (!classId) {
    return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
  }

  const { data: classData } = await auth.supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: managerMembership } = await auth.supabase
    .from("class_students")
    .select("member_role")
    .eq("class_id", classId)
    .eq("student_id", auth.profile.id)
    .maybeSingle();

  const isTeacherOwner = classData.teacher_id === auth.profile.id;
  const isAdmin = auth.profile.role === "admin";
  const isTeacherMemberManager = managerMembership?.member_role === "teacher";
  const isSelfLeave = studentId === auth.profile.id;
  const isCreatorTarget = studentId === classData.teacher_id;

  if (isCreatorTarget) {
    return NextResponse.json({ error: "Class creator cannot be removed." }, { status: 403 });
  }

  if (!isTeacherOwner && !isAdmin && !isTeacherMemberManager && !isSelfLeave) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Membership removed." });
}
