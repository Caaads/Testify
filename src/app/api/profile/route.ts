import { NextResponse } from "next/server";
import { getApiAuthProfile } from "@/lib/api-auth";

function isGoogleManagedAccount(providers: unknown): boolean {
  if (!Array.isArray(providers)) {
    return false;
  }

  return providers.includes("google");
}

export async function PATCH(request: Request) {
  const auth = await getApiAuthProfile();
  if ("error" in auth) {
    return auth.error;
  }

  const providers = auth.user.app_metadata?.providers;
  if (isGoogleManagedAccount(providers)) {
    return NextResponse.json(
      { error: "Name editing is disabled for Google-authenticated accounts." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { fullName?: string };
  const fullName = String(body.fullName ?? "").trim();

  if (fullName.length < 2 || fullName.length > 80) {
    return NextResponse.json(
      { error: "Full name must be between 2 and 80 characters." },
      { status: 400 },
    );
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", auth.profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Profile updated.", fullName });
}