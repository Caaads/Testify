import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "student" && auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only students, teachers, or admin can request to join classes." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();
  const classPassword = String(body.classPassword ?? "").trim();
  const joinAsRaw = String(body.joinAs ?? "").trim().toLowerCase();
  const joinAs = joinAsRaw === "teacher" ? "teacher" : "student";

  if (!classId) {
    return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
  }

  if (auth.profile.role === "student" && joinAs === "teacher") {
    return NextResponse.json({ error: "Students cannot request teacher access." }, { status: 403 });
  }

  const { data: classData, error: classError } = await auth.supabase
    .from("classes")
    .select("id, class_password, teacher_id")
    .eq("id", classId)
    .single();

  if (classError || !classData) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (classData.teacher_id === auth.profile.id) {
    return NextResponse.json({ error: "You already own this class." }, { status: 400 });
  }

  if (classData.class_password && classData.class_password !== classPassword) {
    return NextResponse.json({ error: "Invalid class password." }, { status: 403 });
  }

  const { data: existingStudent } = await auth.supabase
    .from("class_students")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", auth.profile.id)
    .maybeSingle();

  if (existingStudent) {
    return NextResponse.json({ message: "You are already in this class." });
  }

  const { data: existingRequests } = await auth.supabase
    .from("class_join_requests")
    .select("id, status")
    .eq("class_id", classId)
    .eq("student_id", auth.profile.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestRequest = existingRequests?.[0] ?? null;

  if (latestRequest?.status === "pending") {
    return NextResponse.json({ message: "Join request is already pending." });
  }

  if (latestRequest?.status === "approved") {
    const { error: resubmitFromApprovedError } = await auth.supabase
      .from("class_join_requests")
      .update({
        status: "pending",
        student_name: auth.profile.full_name,
        student_role: auth.profile.role,
        requested_role: joinAs,
        created_at: new Date().toISOString(),
      })
      .eq("id", latestRequest.id);

    if (resubmitFromApprovedError) {
      return NextResponse.json({ error: resubmitFromApprovedError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Join request re-submitted." }, { status: 200 });
  }

  if (latestRequest?.status === "rejected") {
    const { error: resubmitError } = await auth.supabase
      .from("class_join_requests")
      .update({
        status: "pending",
        student_name: auth.profile.full_name,
        student_role: auth.profile.role,
        requested_role: joinAs,
        created_at: new Date().toISOString(),
      })
      .eq("id", latestRequest.id);

    if (resubmitError) {
      return NextResponse.json({ error: resubmitError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Join request re-submitted." }, { status: 200 });
  }

  const { error } = await auth.supabase.from("class_join_requests").insert({
    class_id: classId,
    student_id: auth.profile.id,
    student_name: auth.profile.full_name,
    student_role: auth.profile.role,
    requested_role: joinAs,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Join request submitted." }, { status: 201 });
}
