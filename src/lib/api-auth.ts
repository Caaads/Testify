import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth";
import type { UserRole } from "@/lib/supabase/types";

export async function getApiAuthProfile() {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, teacher_status")
    .eq("id", authData.user.id)
    .single();

  if (!profile) {
    return {
      error: NextResponse.json(
        { error: "Profile not found. Please register." },
        { status: 404 },
      ),
    };
  }

  return { supabase, profile: profile as Profile, user: authData.user };
}

export function hasRole(profile: Profile, allowed: UserRole[]) {
  return allowed.includes(profile.role);
}

export function canManageClasses(profile: Profile) {
  if (profile.role === "admin") {
    return true;
  }

  return profile.role === "teacher" && profile.teacher_status === "approved";
}
