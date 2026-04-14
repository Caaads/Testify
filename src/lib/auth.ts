import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  teacher_status: "pending" | "approved" | "rejected";
};

export async function getSessionUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function getCurrentProfile() {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, teacher_status")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireProfile() {
  await requireAuth();
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/register");
  }
  return profile;
}

export async function requireRole(roles: UserRole[]) {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}

export function canCreateClass(profile: Profile) {
  if (profile.role === "admin") {
    return true;
  }

  return profile.role === "teacher" && profile.teacher_status === "approved";
}
