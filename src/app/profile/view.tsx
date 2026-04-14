"use client";

import { FormEvent, useState } from "react";
import type { UserRole } from "@/lib/supabase/types";

type ProfileStats = {
  classesCreated: number;
  classesJoined: number;
  pendingJoinRequests: number;
  quizzesSubmitted: number;
};

export function ProfileClientView({
  email,
  initialName,
  role,
  teacherStatus,
  canEditName,
  stats,
}: {
  email: string;
  initialName: string;
  role: UserRole;
  teacherStatus: "pending" | "approved" | "rejected";
  canEditName: boolean;
  stats: ProfileStats;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const trimmed = fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setMessage("Full name must be between 2 and 80 characters.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: trimmed }),
    });

    const payload = (await response.json()) as { error?: string; message?: string; fullName?: string };
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error || "Unable to update profile.");
      return;
    }

    setFullName(payload.fullName || trimmed);
    setMessage(payload.message || "Profile updated.");
  }

  return (
    <div className="space-y-5">
      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Account details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
            <p className="mt-1 text-sm text-zinc-800">{email || "No email available"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Role</p>
            <p className="mt-1 text-sm capitalize text-zinc-800">
              {role}
              {role === "teacher" ? ` (${teacherStatus})` : ""}
            </p>
          </div>
        </div>

        <form onSubmit={onSave} className="mt-5 space-y-3">
          <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
            Full name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={!canEditName || saving}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100"
          />

          {!canEditName ? (
            <p className="text-sm text-amber-700">
              This account uses Google sign-in, so name editing is disabled in this app.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canEditName || saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Classes created</p>
          <h3 className="mt-1 text-2xl font-bold text-zinc-900">{stats.classesCreated}</h3>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Classes joined</p>
          <h3 className="mt-1 text-2xl font-bold text-zinc-900">{stats.classesJoined}</h3>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Pending join requests</p>
          <h3 className="mt-1 text-2xl font-bold text-zinc-900">{stats.pendingJoinRequests}</h3>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Tests submitted</p>
          <h3 className="mt-1 text-2xl font-bold text-zinc-900">{stats.quizzesSubmitted}</h3>
        </article>
      </section>
    </div>
  );
}