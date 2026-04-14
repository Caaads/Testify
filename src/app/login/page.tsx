"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard&role=student`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_10%,#f8fafc_35%,#f8fafc_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,#0f172a_10%,#0b1220_35%,#0b1220_100%)]">
      <div className="mx-auto mb-4 flex w-full max-w-md justify-end">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-2xl font-bold text-zinc-900">Welcome back to Testify</h1>
        <p className="mt-2 text-sm text-zinc-600">Sign in to continue to your classroom dashboard.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Password
            </label>
            <div className="flex items-center rounded-lg border border-zinc-300 pr-2 focus-within:border-sky-400">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
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

          <button
            type="button"
            className="text-sm font-semibold text-sky-700 hover:underline"
          >
            Forgot password?
          </button>

          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-3 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Continue with Google
        </button>

        <p className="mt-5 text-sm text-zinc-600">
          No account yet?{" "}
          <Link href="/register" className="font-semibold text-sky-700 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
