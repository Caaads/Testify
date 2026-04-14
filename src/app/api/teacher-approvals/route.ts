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

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, full_name, role, teacher_status, created_at")
    .eq("role", "teacher")
    .eq("teacher_status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
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

  if (!teacherId || !["approved", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

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
