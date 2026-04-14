import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const search = request.nextUrl.searchParams.get("search");
  let query = auth.supabase
    .from("classes")
    .select("id, name, description, teacher_id, year_level, created_at")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: classes, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classes: classes ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json(
      { error: "Only approved teachers and admin can create classes." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const yearLevel = String(body.yearLevel ?? "").trim();
  const classPassword = String(body.classPassword ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Class name is required." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("classes")
    .insert({
      name,
      description: description || null,
      year_level: yearLevel || null,
      class_password: classPassword || null,
      teacher_id: auth.profile.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classId: data.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const isAdmin = auth.profile.role === "admin";

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();
  const newOwnerId = String(body.newOwnerId ?? "").trim();

  if (!classId || !newOwnerId) {
    return NextResponse.json({ error: "Class ID and new owner are required." }, { status: 400 });
  }

  const { data: classData } = await auth.supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!classData) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (!isAdmin && classData.teacher_id !== auth.profile.id) {
    return NextResponse.json({ error: "Only the current owner can transfer ownership." }, { status: 403 });
  }

  if (newOwnerId === auth.profile.id) {
    return NextResponse.json({ error: "Selected user is already the owner." }, { status: 400 });
  }

  const [{ data: memberData }, { data: profileData }] = await Promise.all([
    auth.supabase
      .from("class_students")
      .select("member_role")
      .eq("class_id", classId)
      .eq("student_id", newOwnerId)
      .maybeSingle(),
    auth.supabase
      .from("profiles")
      .select("role")
      .eq("id", newOwnerId)
      .maybeSingle(),
  ]);

  if (!memberData) {
    return NextResponse.json({ error: "New owner must be a class member." }, { status: 400 });
  }

  if (profileData?.role !== "teacher" && profileData?.role !== "admin") {
    return NextResponse.json({ error: "New owner must be a teacher or admin member." }, { status: 400 });
  }

  const ownerRole = profileData.role;

  const { error: classUpdateError } = await auth.supabase
    .from("classes")
    .update({ teacher_id: newOwnerId })
    .eq("id", classId);

  if (classUpdateError) {
    return NextResponse.json({ error: classUpdateError.message }, { status: 500 });
  }

  const { error: previousOwnerCleanupError } = await auth.supabase
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", auth.profile.id);

  if (previousOwnerCleanupError) {
    return NextResponse.json({ error: previousOwnerCleanupError.message }, { status: 500 });
  }

  return NextResponse.json({ message: `Ownership transferred to ${ownerRole}.` }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const classId = String(body.classId ?? "").trim();

  if (!classId) {
    return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
  }

  const { data: classData } = await auth.supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!classData) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (classData.teacher_id !== auth.profile.id) {
    return NextResponse.json({ error: "Only the class owner can delete this class." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("classes")
    .delete()
    .eq("id", classId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Class deleted." }, { status: 200 });
}
