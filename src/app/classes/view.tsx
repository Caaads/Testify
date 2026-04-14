"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClassSearchQuery } from "@/components/AppShell";
import type { UserRole } from "@/lib/supabase/types";

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  year_level: string | null;
  teacher_id: string;
  created_at: string;
};

export function ClassesClient({
  profileId,
  role,
  canCreate,
  classes,
  teacherNameById,
  joinedClassIds,
  joinedClassRoleById,
}: {
  profileId: string;
  role: UserRole;
  canCreate: boolean;
  classes: ClassItem[];
  teacherNameById: Record<string, string>;
  joinedClassIds: string[];
  joinedClassRoleById: Record<string, string | null>;
}) {
  const router = useRouter();
  const searchQuery = useClassSearchQuery();
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [classPassword, setClassPassword] = useState("");

  const [joinPassword, setJoinPassword] = useState<Record<string, string>>({});
  const [joinRoleModalClassId, setJoinRoleModalClassId] = useState<string | null>(null);
  const search = searchQuery.trim().toLowerCase();

  const visibleClasses = useMemo(() => {
    if (!search) return classes;
    return classes.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        (item.description || "").toLowerCase().includes(search) ||
        (teacherNameById[item.teacher_id] || "").toLowerCase().includes(search),
    );
  }, [search, classes, teacherNameById]);

  async function createClass(event: FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, yearLevel, classPassword }),
    });

    const payload = (await response.json()) as { error?: string; classId?: string };

    if (!response.ok) {
      setMessage(payload.error || "Unable to create class.");
      return;
    }

    setName("");
    setDescription("");
    setYearLevel("");
    setClassPassword("");
    setMessage("Class created successfully.");
    router.refresh();
  }

  async function joinClass(classId: string, joinAs: "student" | "teacher" = "student") {
    const response = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, classPassword: joinPassword[classId] || "", joinAs }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setMessage(payload.error || "Join request failed.");
      return;
    }

    setMessage(payload.message || "Join request submitted.");
    setJoinRoleModalClassId(null);
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      {canCreate ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Create class</h2>
          <form onSubmit={createClass} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Class name"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              placeholder="Year level"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={classPassword}
              onChange={(e) => setClassPassword(e.target.value)}
              placeholder="Optional class password"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Save class
            </button>
          </form>
        </section>
      ) : null}

      {!canCreate && role === "teacher" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Teacher approval is pending. You cannot create classes yet.
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">All classes</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleClasses.map((item) => {
            const isTeacherOwner = item.teacher_id === profileId;
            const isJoined = joinedClassIds.includes(item.id);
            const joinedRole = joinedClassRoleById[item.id];
            const canOpenClass = isJoined || isTeacherOwner || role === "admin";

            return (
              <article key={item.id} className="rounded-xl border border-zinc-200 p-4">
                <h3 className="text-base font-semibold text-zinc-900">{item.name}</h3>
                <p className="mt-1 text-sm text-zinc-600">{item.description || "No description"}</p>
                <p className="mt-2 text-xs text-zinc-500">Year: {item.year_level || "N/A"}</p>
                <p className="text-xs text-zinc-500">
                  Created by: {teacherNameById[item.teacher_id] || "Unknown Teacher"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canOpenClass ? (
                    <Link
                      href={`/classes/${item.id}`}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      Open class
                    </Link>
                  ) : null}

                  {(role === "student" || role === "teacher" || role === "admin") && !isJoined && !isTeacherOwner ? (
                    <>
                      <input
                        value={joinPassword[item.id] || ""}
                        onChange={(e) =>
                          setJoinPassword((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Password (if required)"
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (role === "teacher" || role === "admin") {
                            setJoinRoleModalClassId(item.id);
                            return;
                          }
                          void joinClass(item.id, "student");
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Request join
                      </button>
                    </>
                  ) : null}

                  {isTeacherOwner ? (
                    <span className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">
                      You are the teacher
                    </span>
                  ) : joinedRole === "teacher" ? (
                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                      Joined as teacher
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}

          {visibleClasses.length === 0 ? (
            <p className="text-sm text-zinc-500">No classes found.</p>
          ) : null}
        </div>
      </section>

      {joinRoleModalClassId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Join class as</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Choose your role for this class. Teacher role can manage tests, announcements, and members.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void joinClass(joinRoleModalClassId, "student")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Join as student
              </button>
              <button
                type="button"
                onClick={() => void joinClass(joinRoleModalClassId, "teacher")}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Join as teacher
              </button>
            </div>
            <button
              type="button"
              onClick={() => setJoinRoleModalClassId(null)}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
