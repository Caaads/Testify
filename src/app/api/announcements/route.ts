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

export async function GET(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const classId = request.nextUrl.searchParams.get("classId")?.trim();
  if (!classId) {
    return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("announcements")
    .select("id, class_id, content, created_at, created_by")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const creatorIds = [...new Set((data ?? []).map((item) => item.created_by).filter(Boolean))] as string[];
  const { data: profiles } = creatorIds.length > 0
    ? await auth.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds)
    : { data: [] };

  const creatorNameMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name] as const));

  return NextResponse.json({
    announcements: (data ?? []).map((item) => ({
      ...item,
      creator_name: item.created_by ? creatorNameMap.get(item.created_by) || null : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Only teachers/admin can post." }, { status: 403 });
  }

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();
  const content = String(body.content ?? "").trim();

  if (!classId || !content) {
    return NextResponse.json(
      { error: "Class ID and announcement content are required." },
      { status: 400 },
    );
  }

  const hasAccess = await hasClassManageAccess(auth, classId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("announcements")
    .insert({ class_id: classId, content, created_by: auth.profile.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Announcement posted." }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Only teachers/admin can edit announcements." }, { status: 403 });
  }

  const body = await request.json();
  const announcementId = String(body.announcementId ?? "").trim();
  const content = String(body.content ?? "").trim();

  if (!announcementId || !content) {
    return NextResponse.json(
      { error: "Announcement ID and content are required." },
      { status: 400 },
    );
  }

  const { data: announcementData } = await auth.supabase
    .from("announcements")
    .select("id, class_id")
    .eq("id", announcementId)
    .single();

  if (!announcementData) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const hasAccess = await hasClassManageAccess(auth, announcementData.class_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("announcements")
    .update({ content })
    .eq("id", announcementId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Announcement updated." }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "teacher" && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Only teachers/admin can delete announcements." }, { status: 403 });
  }

  const body = await request.json();
  const announcementId = String(body.announcementId ?? "").trim();

  if (!announcementId) {
    return NextResponse.json({ error: "Announcement ID is required." }, { status: 400 });
  }

  const { data: announcementData } = await auth.supabase
    .from("announcements")
    .select("id, class_id")
    .eq("id", announcementId)
    .single();

  if (!announcementData) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const hasAccess = await hasClassManageAccess(auth, announcementData.class_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Announcement deleted." }, { status: 200 });
}
