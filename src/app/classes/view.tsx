"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CiCirclePlus } from "react-icons/ci";
import { useClassSearchQuery } from "@/components/AppShell";
import type { UserRole } from "@/lib/supabase/types";

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  year_level: string | null;
  strand: string | null;
  course: string | null;
  teacher_id: string;
  created_at: string;
};

const YEAR_LEVEL_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "College 1st Year",
  "College 2nd Year",
  "College 3rd Year",
  "College 4th Year",
  "College 5th Year",
] as const;

const STRAND_OPTIONS = ["STEM", "ABM", "HUMSS", "GAS", "TVL", "Arts and Design", "Sports", "Other"] as const;
const COURSE_OPTIONS = ["BSIT", "BSCS", "BSBA", "BSED", "BEED", "BSN", "BSA", "Other"] as const;

function isSeniorHighYear(level: string) {
  return level === "Grade 11" || level === "Grade 12";
}

function isCollegeYear(level: string) {
  return level.startsWith("College ");
}

function getClassAcademicLabel(item: ClassItem) {
  if (isSeniorHighYear(item.year_level || "")) {
    return item.strand ? `${item.year_level} - ${item.strand}` : item.year_level || "N/A";
  }

  if (isCollegeYear(item.year_level || "")) {
    return item.course ? `${item.year_level} - ${item.course}` : item.year_level || "N/A";
  }

  return item.year_level || "N/A";
}

function getClassIconConfig(name: string, yearLevel: string | null) {
  const text = `${name} ${yearLevel || ""}`.toLowerCase();
  const matches = (terms: string[]) => terms.some((term) => text.includes(term));

  if (matches(["math", "algebra", "geometry", "calculus", "statistics"])) {
    return {
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </svg>
      ),
    };
  }

  if (matches(["biology", "chemistry", "physics", "science", "lab"])) {
    return {
      bg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M10 3h4M11 3v6l-4.5 7A3 3 0 0 0 9 20h6a3 3 0 0 0 2.5-4L13 9V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    };
  }

  if (matches(["history", "social", "government", "world"])) {
    return {
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M4 19V6a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 6v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  if (matches(["english", "literature", "reading", "writing", "language"])) {
    return {
      bg: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M18 7h1a1 1 0 0 1 1 1v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  if (matches(["computer", "programming", "it", "tech", "coding"])) {
    return {
      bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M4 5h16v11H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 20h8M10 16v4M14 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    };
  }

  return {
    bg: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    icon: <span className="text-sm font-black">C</span>,
  };
}

export function ClassesClient({
  profileId,
  role,
  canCreate,
  classes,
  teacherNameById,
  joinedClassIds,
  joinedClassRoleById,
  pendingJoinRequestClassIds,
}: {
  profileId: string;
  role: UserRole;
  canCreate: boolean;
  classes: ClassItem[];
  teacherNameById: Record<string, string>;
  joinedClassIds: string[];
  joinedClassRoleById: Record<string, string | null>;
  pendingJoinRequestClassIds: string[];
}) {
  const router = useRouter();
  const searchQuery = useClassSearchQuery();
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [strandChoice, setStrandChoice] = useState("");
  const [strandOther, setStrandOther] = useState("");
  const [courseChoice, setCourseChoice] = useState("");
  const [courseOther, setCourseOther] = useState("");
  const [classPassword, setClassPassword] = useState("");
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editYearLevel, setEditYearLevel] = useState("");
  const [editStrandChoice, setEditStrandChoice] = useState("");
  const [editStrandOther, setEditStrandOther] = useState("");
  const [editCourseChoice, setEditCourseChoice] = useState("");
  const [editCourseOther, setEditCourseOther] = useState("");
  const [savingEditClass, setSavingEditClass] = useState(false);

  const [joinPassword, setJoinPassword] = useState<Record<string, string>>({});
  const [joinRoleModalClassId, setJoinRoleModalClassId] = useState<string | null>(null);
  const [requestedClassIds, setRequestedClassIds] = useState<string[]>(pendingJoinRequestClassIds);
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

    const needsStrand = isSeniorHighYear(yearLevel);
    const needsCourse = isCollegeYear(yearLevel);
    const strand = needsStrand
      ? (strandChoice === "Other" ? strandOther : strandChoice).trim()
      : "";
    const course = needsCourse
      ? (courseChoice === "Other" ? courseOther : courseChoice).trim()
      : "";

    if (!yearLevel) {
      setMessage("Year level is required.");
      return;
    }

    if (needsStrand && !strand) {
      setMessage("Please select or enter a strand.");
      return;
    }

    if (needsCourse && !course) {
      setMessage("Please select or enter a course.");
      return;
    }

    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, yearLevel, strand, course, classPassword }),
    });

    const payload = (await response.json()) as { error?: string; classId?: string };

    if (!response.ok) {
      setMessage(payload.error || "Unable to create class.");
      return;
    }

    setName("");
    setDescription("");
    setYearLevel("");
    setStrandChoice("");
    setStrandOther("");
    setCourseChoice("");
    setCourseOther("");
    setClassPassword("");
    setMessage("Class created successfully.");
    router.refresh();
  }

  function openEditClassModal(item: ClassItem) {
    setEditingClass(item);
    setEditName(item.name);
    setEditDescription(item.description || "");
    const nextYearLevel = item.year_level || "";
    setEditYearLevel(nextYearLevel);

    if (isSeniorHighYear(nextYearLevel)) {
      const strand = (item.strand || "").trim();
      if (strand && STRAND_OPTIONS.includes(strand as (typeof STRAND_OPTIONS)[number])) {
        setEditStrandChoice(strand);
        setEditStrandOther("");
      } else if (strand) {
        setEditStrandChoice("Other");
        setEditStrandOther(strand);
      } else {
        setEditStrandChoice("");
        setEditStrandOther("");
      }
      setEditCourseChoice("");
      setEditCourseOther("");
      return;
    }

    if (isCollegeYear(nextYearLevel)) {
      const course = (item.course || "").trim();
      if (course && COURSE_OPTIONS.includes(course as (typeof COURSE_OPTIONS)[number])) {
        setEditCourseChoice(course);
        setEditCourseOther("");
      } else if (course) {
        setEditCourseChoice("Other");
        setEditCourseOther(course);
      } else {
        setEditCourseChoice("");
        setEditCourseOther("");
      }
      setEditStrandChoice("");
      setEditStrandOther("");
      return;
    }

    setEditStrandChoice("");
    setEditStrandOther("");
    setEditCourseChoice("");
    setEditCourseOther("");
  }

  async function updateClass(event: FormEvent) {
    event.preventDefault();

    if (!editingClass) {
      return;
    }

    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();
    const needsStrand = isSeniorHighYear(editYearLevel);
    const needsCourse = isCollegeYear(editYearLevel);
    const strand = needsStrand
      ? (editStrandChoice === "Other" ? editStrandOther : editStrandChoice).trim()
      : "";
    const course = needsCourse
      ? (editCourseChoice === "Other" ? editCourseOther : editCourseChoice).trim()
      : "";

    if (!trimmedName) {
      setMessage("Class name is required.");
      return;
    }

    if (!editYearLevel) {
      setMessage("Year level is required.");
      return;
    }

    if (needsStrand && !strand) {
      setMessage("Please select or enter a strand.");
      return;
    }

    if (needsCourse && !course) {
      setMessage("Please select or enter a course.");
      return;
    }

    setSavingEditClass(true);
    const response = await fetch("/api/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: editingClass.id,
        name: trimmedName,
        description: trimmedDescription,
        yearLevel: editYearLevel,
        strand,
        course,
      }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSavingEditClass(false);

    if (!response.ok) {
      setMessage(payload.error || "Unable to update class.");
      return;
    }

    setMessage(payload.message || "Class updated.");
    setEditingClass(null);
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
    setRequestedClassIds((current) => Array.from(new Set([...current, classId])));
    setJoinRoleModalClassId(null);
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      {canCreate ? (
        <section className="rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <div className="mb-4 flex items-center gap-3">
            <CiCirclePlus className="h-12 w-12 text-[var(--muted)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Create class</h2>
              <p className="text-sm text-[var(--muted)]">Set up a new class for your students.</p>
            </div>
          </div>
          <form onSubmit={createClass} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Class name"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              required
              value={yearLevel}
              onChange={(e) => {
                const nextLevel = e.target.value;
                setYearLevel(nextLevel);
                if (!isSeniorHighYear(nextLevel)) {
                  setStrandChoice("");
                  setStrandOther("");
                }
                if (!isCollegeYear(nextLevel)) {
                  setCourseChoice("");
                  setCourseOther("");
                }
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select year level</option>
              {YEAR_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {isSeniorHighYear(yearLevel) ? (
              <>
                <select
                  required
                  value={strandChoice}
                  onChange={(e) => setStrandChoice(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Select strand</option>
                  {STRAND_OPTIONS.map((strand) => (
                    <option key={strand} value={strand}>
                      {strand}
                    </option>
                  ))}
                </select>
                {strandChoice === "Other" ? (
                  <input
                    required
                    value={strandOther}
                    onChange={(e) => setStrandOther(e.target.value)}
                    placeholder="Enter strand"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                ) : null}
              </>
            ) : null}
            {isCollegeYear(yearLevel) ? (
              <>
                <select
                  required
                  value={courseChoice}
                  onChange={(e) => setCourseChoice(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Select course</option>
                  {COURSE_OPTIONS.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                {courseChoice === "Other" ? (
                  <input
                    required
                    value={courseOther}
                    onChange={(e) => setCourseOther(e.target.value)}
                    placeholder="Enter course"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                ) : null}
              </>
            ) : null}
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
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 sm:col-span-2"
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
            const isJoinRequested = requestedClassIds.includes(item.id);
            const canOpenClass = isJoined || isTeacherOwner || role === "admin";
            const classIcon = getClassIconConfig(item.name, item.year_level);

            return (
              <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)]">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${classIcon.bg}`}>
                    {classIcon.icon}
                  </div>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">{item.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.description || "No description"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{getClassAcademicLabel(item)}</p>
                <p className="text-xs text-[var(--muted)]">
                  Created by: {teacherNameById[item.teacher_id] || "Unknown Teacher"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canOpenClass ? (
                    <Link
                      href={`/classes/${item.id}`}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                    >
                      Open class
                    </Link>
                  ) : null}

                  {(isTeacherOwner || role === "admin") ? (
                    <button
                      type="button"
                      onClick={() => openEditClassModal(item)}
                      className="rounded-lg border border-sky-300 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300"
                    >
                      Edit class
                    </button>
                  ) : null}

                  {(role === "student" || role === "teacher" || role === "admin") && !isJoined && !isTeacherOwner && !isJoinRequested ? (
                    <>
                      <input
                        value={joinPassword[item.id] || ""}
                        onChange={(e) =>
                          setJoinPassword((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Password (if required)"
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
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

                  {(role === "student" || role === "teacher" || role === "admin") && isJoinRequested && !isJoined && !isTeacherOwner ? (
                    <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      Request sent
                    </span>
                  ) : null}

                  {isTeacherOwner ? (
                    <span className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      You are the teacher
                    </span>
                  ) : joinedRole === "teacher" ? (
                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
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

      {editingClass ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingClass(null)}>
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900">Edit class</h3>
            <p className="mt-1 text-sm text-zinc-600">Rename and update class details.</p>
            <form onSubmit={updateClass} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Class name"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <select
                required
                value={editYearLevel}
                onChange={(e) => {
                  const nextLevel = e.target.value;
                  setEditYearLevel(nextLevel);
                  if (!isSeniorHighYear(nextLevel)) {
                    setEditStrandChoice("");
                    setEditStrandOther("");
                  }
                  if (!isCollegeYear(nextLevel)) {
                    setEditCourseChoice("");
                    setEditCourseOther("");
                  }
                }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select year level</option>
                {YEAR_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>

              {isSeniorHighYear(editYearLevel) ? (
                <>
                  <select
                    required
                    value={editStrandChoice}
                    onChange={(e) => setEditStrandChoice(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select strand</option>
                    {STRAND_OPTIONS.map((strand) => (
                      <option key={strand} value={strand}>
                        {strand}
                      </option>
                    ))}
                  </select>
                  {editStrandChoice === "Other" ? (
                    <input
                      required
                      value={editStrandOther}
                      onChange={(e) => setEditStrandOther(e.target.value)}
                      placeholder="Enter strand"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  ) : null}
                </>
              ) : null}

              {isCollegeYear(editYearLevel) ? (
                <>
                  <select
                    required
                    value={editCourseChoice}
                    onChange={(e) => setEditCourseChoice(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select course</option>
                    {COURSE_OPTIONS.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                  {editCourseChoice === "Other" ? (
                    <input
                      required
                      value={editCourseOther}
                      onChange={(e) => setEditCourseOther(e.target.value)}
                      placeholder="Enter course"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  ) : null}
                </>
              ) : null}

              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
              />

              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingEditClass}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEditClass ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
