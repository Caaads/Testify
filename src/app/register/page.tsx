"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { UserRole } from "@/lib/supabase/types";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard&role=${role}`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const teacherStatus = role === "teacher" ? "pending" : "approved";

      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: fullName,
          role,
          teacher_status: teacherStatus,
        },
        { onConflict: "id" },
      );
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function signUpWithGoogle() {
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard&role=${role}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ecfccb_10%,#f8fafc_35%,#f8fafc_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,#0f172a_10%,#0b1220_35%,#0b1220_100%)]">
      <div className="mx-auto mb-4 flex w-full max-w-lg justify-end">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-2xl font-bold text-zinc-900">Create your Testify account</h1>
        <p className="mt-2 text-sm text-zinc-600">Choose your role after signup. Teachers require admin approval.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-zinc-700">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-lime-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-lime-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <div className="flex items-center rounded-lg border border-zinc-300 pr-2 focus-within:border-lime-500">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border-0 px-3 py-2 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10.5 10.5a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5.5 0 9.5 4 10.5 8-0.38 1.49-1.16 2.91-2.22 4.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.23 6.23C4.56 7.47 3.33 9.13 2.5 12c1 4 5 8 9.5 8 1.85 0 3.53-0.45 5-1.23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M2.5 12c1-4 5-8 9.5-8s8.5 4 9.5 8c-1 4-5 8-9.5 8s-8.5-4-9.5-8z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="text-sm font-semibold text-lime-700 hover:underline"
          >
            Forgot password?
          </button>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-700">Role</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["student", "teacher"] as const).map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 p-3 text-sm">
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={role === option}
                    onChange={() => setRole(option)}
                  />
                  <span className="capitalize">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-lime-300"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <button
          type="button"
          onClick={signUpWithGoogle}
          className="mt-3 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Continue with Google
        </button>

        <p className="mt-5 text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-lime-700 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
