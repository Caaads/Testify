import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";

const BUCKET = "quiz-question-images";
const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

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

  return { ok: true as const };
}

function extensionFromType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageClasses(auth.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const formData = await request.formData();
  const classId = String(formData.get("classId") ?? "").trim();
  const file = formData.get("file");

  if (!classId) {
    return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
  }

  const permission = await authorizeClassManager(auth, classId);
  if ("error" in permission) {
    return permission.error;
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, WEBP, and GIF files are allowed." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Image is too large. Maximum size is 8MB." }, { status: 400 });
  }

  const extension = extensionFromType(file.type);
  const path = `${classId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await auth.supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = auth.supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl, path }, { status: 201 });
}
