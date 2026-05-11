import { NextRequest, NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

export async function GET() {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  // Return both all teachers and pending teacher requests so the admin
  // UI can display a full management view.
  const [{ data: teachers, error: teachersError }, { data: requests, error: requestsError }] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id, full_name, role, teacher_status, created_at")
      .eq("role", "teacher")
      .order("full_name", { ascending: true }),
    auth.supabase
      .from("profiles")
      .select("id, full_name, role, teacher_status, created_at")
      .eq("role", "teacher")
      .eq("teacher_status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  if (teachersError || requestsError) {
    return NextResponse.json({ error: (teachersError || requestsError)?.message || "Failed to load teachers." }, { status: 500 });
  }

  return NextResponse.json({ teachers: teachers ?? [], requests: requests ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = await request.json();
  const teacherId = String(body.teacherId ?? "").trim();
  const action = String(body.action ?? "").trim();

  if (!teacherId || !["approved", "rejected", "demote", "remove"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Approve / reject keep the teacher role but update teacher_status
  if (action === "approved" || action === "rejected") {
    const { error } = await auth.supabase
      .from("profiles")
      .update({ teacher_status: action as "approved" | "rejected" })
      .eq("id", teacherId)
      .eq("role", "teacher");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: `Teacher ${action}.` });
  }

  // Demote: change role to student and clear teacher_status
  if (action === "demote") {
    const { error } = await auth.supabase
      .from("profiles")
      .update({ role: "student", teacher_status: null })
      .eq("id", teacherId)
      .eq("role", "teacher");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Teacher demoted to student." });
  }

  // Remove: delete the profile row (destructive)
  if (action === "remove") {
    const { error } = await auth.supabase.from("profiles").delete().eq("id", teacherId).eq("role", "teacher");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Teacher removed." });
  }

  return NextResponse.json({ error: "Unhandled action." }, { status: 400 });
}
