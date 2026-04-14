import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  const requestId = String(body.requestId ?? "").trim();
  const action = String(body.action ?? "").trim();
  const isAdmin = auth.profile.role === "admin";

  if (!requestId || !["approved", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: joinRequest } = await auth.supabase
    .from("class_join_requests")
    .select("id, class_id, student_id, student_name, requested_role")
    .eq("id", requestId)
    .single();

  if (!joinRequest) {
    return NextResponse.json({ error: "Join request not found." }, { status: 404 });
  }

  if (!isAdmin) {
    const [{ data: classData }, { data: managerMembership }] = await Promise.all([
      auth.supabase
        .from("classes")
        .select("teacher_id")
        .eq("id", joinRequest.class_id)
        .maybeSingle(),
      auth.supabase
        .from("class_students")
        .select("member_role")
        .eq("class_id", joinRequest.class_id)
        .eq("student_id", auth.profile.id)
        .maybeSingle(),
    ]);

    const canManageAsTeacherMember = managerMembership?.member_role === "teacher";
    if (!classData || (classData.teacher_id !== auth.profile.id && !canManageAsTeacherMember)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
  }

  const { error: updateError } = await auth.supabase
    .from("class_join_requests")
    .update({ status: action as "approved" | "rejected" })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (action === "approved") {
    const { error: insertError } = await auth.supabase.from("class_students").upsert(
      {
        class_id: joinRequest.class_id,
        student_id: joinRequest.student_id,
        student_name: joinRequest.student_name,
        member_role: joinRequest.requested_role === "teacher" ? "teacher" : "student",
      },
      { onConflict: "class_id,student_id" },
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ message: `Request ${action}.` });
}
