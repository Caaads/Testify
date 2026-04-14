import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

function sanitizeRole(role: string | null): UserRole {
  if (role === "teacher") {
    return role;
  }
  return "student";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const selectedRole = sanitizeRole(requestUrl.searchParams.get("role"));

  if (!code) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth", requestUrl.origin));
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (user) {
    const role: UserRole = selectedRole;
    const teacherStatus = role === "teacher" ? "pending" : "approved";

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: user.user_metadata.full_name ?? user.user_metadata.name ?? null,
        role,
        teacher_status: teacherStatus,
      },
      { onConflict: "id" },
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
