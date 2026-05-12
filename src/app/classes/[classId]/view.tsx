"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatWallClockDateTime } from "@/lib/date-utils";
import { useClassSearchQuery } from "@/components/AppShell";
import type { UserRole } from "@/lib/supabase/types";

type JoinRequest = {
  id: string;
  status: string;
  created_at: string;
  student_id: string;
  student_name: string | null;
  student_role: string | null;
  requested_role: string | null;
  profiles: { full_name: string | null }[];
};

type Term = { id: string; name: string };

type Quiz = {
  id: string;
  title: string;
  term_id: string;
  duration: number | null;
  total_score: number;
  allow_auto_score: boolean;
  allow_review: boolean;
  opens_at: string | null;
  closes_at: string | null;
  quiz_password: string | null;
  created_at: string;
  created_by: string | null;
  profiles: { full_name: string | null }[];
};

type Announcement = {
  id: string;
  content: string | null;
  created_at: string;
  created_by: string | null;
  creator_name?: string | null;
  profiles: { full_name: string | null }[];
};

type OwnershipCandidate = {
  id: string;
  name: string;
};

export function ClassDetailClient({
  classId,
  role,
  canManage,
  isOwner,
  className,
  classYearLevel,
  canLeave,
  classDescription,
  classCreatorName,
  ownershipCandidates,
  joinRequests,
  terms,
  quizzes,
  announcements,
}: {
  classId: string;
  role: UserRole;
  canManage: boolean;
  isOwner: boolean;
  className: string;
  classYearLevel?: string | number | null;
  canLeave: boolean;
  classDescription: string;
  classCreatorName: string;
  ownershipCandidates: OwnershipCandidate[];
  joinRequests: JoinRequest[];
  terms: Term[];
  quizzes: Quiz[];
  announcements: Announcement[];
}) {
  const router = useRouter();
  const searchQuery = useClassSearchQuery();
  const [message, setMessage] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [openMenuQuizId, setOpenMenuQuizId] = useState<string | null>(null);
  const [activeTermId, setActiveTermId] = useState(terms[0]?.id ?? "");
  const [editingTerm, setEditingTerm] = useState<{ id: string; name: string } | null>(null);
  const [editTermName, setEditTermName] = useState("");
  const [savingEditTerm, setSavingEditTerm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "term" | "test"; id: string; label: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [ownerLeaveModalOpen, setOwnerLeaveModalOpen] = useState(false);
  const [ownershipTargetId, setOwnershipTargetId] = useState("");
  const [ownerActionLoading, setOwnerActionLoading] = useState(false);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const termMap = useMemo(
    () => new Map(terms.map((term) => [term.id, term.name])),
    [terms],
  );

  const filteredAnnouncements = useMemo(() => {
    if (!normalizedSearch) {
      return announcements;
    }

    return announcements.filter((item) =>
      (item.content || "").toLowerCase().includes(normalizedSearch),
    );
  }, [announcements, normalizedSearch]);

  const testsByTerm = useMemo(() => {
    const filteredTests = !normalizedSearch
      ? quizzes
      : quizzes.filter((quiz) => {
          const termLabel = termMap.get(quiz.term_id) || "";
          return (
            quiz.title.toLowerCase().includes(normalizedSearch) ||
            termLabel.toLowerCase().includes(normalizedSearch)
          );
        });

    const sections = terms.map((term) => ({
      id: term.id,
      name: term.name,
      tests: filteredTests.filter((quiz) => quiz.term_id === term.id),
    }));

    const unassignedTests = filteredTests.filter((quiz) => !termMap.has(quiz.term_id));
    if (unassignedTests.length > 0) {
      sections.push({ id: "__other__", name: "Other", tests: unassignedTests });
    }

    return sections;
  }, [quizzes, terms, termMap, normalizedSearch]);

  const visibleTermSections = useMemo(() => {
    if (!activeTermId) {
      return testsByTerm;
    }

    const selectedSection = testsByTerm.find((section) => section.id === activeTermId);
    return selectedSection ? [selectedSection] : testsByTerm;
  }, [activeTermId, testsByTerm]);

  function displayMemberName(entry: { student_name?: string | null; profiles?: { full_name: string | null }[] }) {
    return entry.student_name || entry.profiles?.[0]?.full_name || "Unnamed Member";
  }

  async function handleJoinRequest(requestId: string, action: "approved" | "rejected") {
    const response = await fetch("/api/classes/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to update request.");
      return;
    }

    setMessage(payload.message || "Join request updated.");
    router.refresh();
  }

  async function leaveClass() {
    const response = await fetch("/api/classes/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to leave class.");
      return;
    }

    setMessage(payload.message || "You left the class.");
    router.push("/classes");
    router.refresh();
  }

  async function transferOwnershipAndLeave() {
    if (!ownershipTargetId) {
      setMessage("Please select a teacher member to transfer ownership.");
      return;
    }

    setOwnerActionLoading(true);
    const response = await fetch("/api/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, newOwnerId: ownershipTargetId }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setOwnerActionLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Unable to transfer ownership.");
      return;
    }

    setMessage(payload.message || "Ownership transferred.");
    setOwnerLeaveModalOpen(false);
    router.push("/classes");
    router.refresh();
  }

  async function deleteClassAsOwner() {
    setOwnerActionLoading(true);
    const response = await fetch("/api/classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setOwnerActionLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Unable to delete class.");
      return;
    }

    setMessage(payload.message || "Class deleted.");
    setOwnerLeaveModalOpen(false);
    router.push("/classes");
    router.refresh();
  }

  async function createTerm(event: FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, name: termName }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to create term.");
      return;
    }

    setTermName("");
    setMessage("Term created.");
    router.refresh();
  }

  function openEditTermModal(termId: string, currentName: string) {
    setEditingTerm({ id: termId, name: currentName });
    setEditTermName(currentName);
  }

  async function submitEditTerm(event: FormEvent) {
    event.preventDefault();

    if (!editingTerm) {
      return;
    }

    const nextName = editTermName.trim();
    if (!nextName) {
      setMessage("Term name is required.");
      return;
    }

    if (nextName === editingTerm.name) {
      setEditingTerm(null);
      return;
    }

    setSavingEditTerm(true);

    const response = await fetch("/api/terms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termId: editingTerm.id, name: nextName }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSavingEditTerm(false);

    if (!response.ok) {
      setMessage(payload.error || "Unable to update term.");
      return;
    }

    setMessage(payload.message || "Term updated.");
    setEditingTerm(null);
    router.refresh();
  }

  function openDeleteModal(kind: "term" | "test", id: string, label: string) {
    setDeleteError(null);
    setDeleteTarget({ kind, id, label });
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget) {
      return;
    }

    setDeletingItem(true);
    setDeleteError(null);
    const endpoint = deleteTarget.kind === "term" ? "/api/terms" : "/api/quizzes";
    const bodyKey = deleteTarget.kind === "term" ? "termId" : "quizId";

    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [bodyKey]: deleteTarget.id }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setDeletingItem(false);

    if (!response.ok) {
      const errorText = payload.error || `Unable to delete ${deleteTarget.kind}.`;
      setDeleteError(errorText);
      setMessage(errorText);
      return;
    }

    setMessage(payload.message || `${deleteTarget.kind === "term" ? "Term" : "Test"} deleted.`);
    setDeleteTarget(null);
    router.refresh();
  }

  async function toggleAutoScore(quizId: string, nextValue: boolean) {
    const response = await fetch("/api/classes/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, allowAutoScore: nextValue }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to update visibility.");
      return;
    }

    setMessage(payload.message || "Visibility updated.");
    router.refresh();
  }

  async function toggleReview(quizId: string, nextValue: boolean) {
    const response = await fetch("/api/classes/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, allowReview: nextValue }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to update review setting.");
      return;
    }

    setMessage(payload.message || "Review setting updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-[2rem] border border-sky-900/25 bg-[linear-gradient(180deg,#051024_0%,#071637_100%)] p-4 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)]">
      {message ? (
        <p className="rounded-2xl border border-cyan-400/20 bg-cyan-950/55 p-3 text-sm text-cyan-100">{message}</p>
      ) : null}

      <section className="rounded-[1.5rem] border border-white/10 bg-[#08183d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{className}</h2>
            <p className="text-sm font-medium text-cyan-200">
              Year level: {classYearLevel ?? "N/A"}
            </p>
            <p className="text-sm text-sky-100/80">{classDescription || "No class description yet."}</p>
            <p className="text-xs text-white/55">Created by: {classCreatorName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <Link
                href={`/classes/${classId}/announcements`}
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                Post Announcement
              </Link>
            ) : null}
            {canManage ? (
              <Link
                href={`/classes/${classId}/quizzes/create`}
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Create New Test
              </Link>
            ) : null}
            {canLeave ? (
              <button
                type="button"
                onClick={leaveClass}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                Leave class
              </button>
            ) : null}
            {isOwner ? (
              <button
                type="button"
                onClick={() => setOwnerLeaveModalOpen(true)}
                className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15"
              >
                Leave owner class
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-[1.5rem] border border-white/10 bg-[#08183d] p-4 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/80">
                {terms.map((term) => (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => setActiveTermId(term.id)}
                    className={
                      term.id === activeTermId
                        ? "border-b-2 border-cyan-400 pb-2 text-cyan-300"
                        : "pb-2 transition hover:text-white"
                    }
                  >
                    {term.name}
                  </button>
                ))}
              </div>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                {visibleTermSections.reduce((total, section) => total + section.tests.length, 0)} tests
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {visibleTermSections.map((termSection) => (
                <div key={termSection.id} className="space-y-3">
                  {termSection.tests.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="rounded-2xl border border-sky-400/15 bg-[#0b1f56] p-4 shadow-sm transition hover:border-cyan-400/30 hover:bg-[#10235f]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-200">
                              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                                <path d="M5 19V5m0 14h14M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-white">{quiz.title}</p>
                              <p className="text-xs text-white/55">
                                {quiz.duration || 0} mins • {quiz.total_score} points
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                            {quiz.opens_at ? "Live now" : "Upcoming"}
                          </span>
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => setOpenMenuQuizId(openMenuQuizId === quiz.id ? null : quiz.id)}
                              className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                              title="More options"
                              aria-label="Open test options"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.8" />
                                <circle cx="12" cy="12" r="1.8" />
                                <circle cx="12" cy="19" r="1.8" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/55">
                        <span>Opens: {quiz.opens_at ? formatWallClockDateTime(quiz.opens_at) : "Anytime"}</span>
                        <span>•</span>
                        <span>Closes: {quiz.closes_at ? formatWallClockDateTime(quiz.closes_at) : "No close"}</span>
                        <span>•</span>
                        <span>Created by: {quiz.profiles?.[0]?.full_name || classCreatorName}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/quizzes/${quiz.id}`}
                          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                        >
                          Open test
                        </Link>
                        {canManage ? (
                          <Link
                            href={`/quizzes/${quiz.id}/review`}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            Review submissions
                          </Link>
                        ) : null}
                      </div>

                      {openMenuQuizId === quiz.id && canManage ? (
                        <div className="relative mt-3 rounded-2xl border border-white/10 bg-[#071637] p-2 shadow-lg">
                          <Link
                            href={`/classes/${classId}/quizzes/${quiz.id}/edit`}
                            className="block rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/5"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuQuizId(null);
                              openDeleteModal("test", quiz.id, quiz.title);
                            }}
                            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-200 hover:bg-white/5"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuQuizId(null);
                              void toggleAutoScore(quiz.id, !quiz.allow_auto_score);
                            }}
                            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                          >
                            <span className="font-semibold">Auto score:</span> {quiz.allow_auto_score ? "Visible" : "Hidden"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuQuizId(null);
                              void toggleReview(quiz.id, !quiz.allow_review);
                            }}
                            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                          >
                            <span className="font-semibold">Student review:</span> {quiz.allow_review ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {termSection.tests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
                      No tests in this term yet.
                    </p>
                  ) : null}
                </div>
              ))}

              {visibleTermSections.every((section) => section.tests.length === 0) ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
                  No tests found.
                </p>
              ) : null}
            </div>
          </section>

          <article className="rounded-[1.5rem] border border-white/10 bg-[#08183d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-white">Class Updates</h3>
              <button type="button" className="text-sm font-semibold text-cyan-200 transition hover:text-cyan-100">
                View All
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {filteredAnnouncements.map((item) => (
                <article key={item.id} className="rounded-2xl border border-sky-400/15 bg-[#0b1f56] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                      {String((item.creator_name || classCreatorName || "A")[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{item.creator_name || classCreatorName}</p>
                        <p className="text-xs text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/85">{item.content}</p>
                    </div>
                  </div>
                </article>
              ))}
              {filteredAnnouncements.length === 0 ? <p className="text-sm text-white/55">No announcements found.</p> : null}
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          {canManage ? (
            <section className="rounded-[1.5rem] border border-white/10 bg-[#08183d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
              <h3 className="text-lg font-semibold text-white">Create term</h3>
              <form onSubmit={createTerm} className="mt-3 flex gap-2">
                <input
                  required
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  placeholder="ex. 1st grading, Prelim, etc."
                  className="w-full rounded-xl border border-white/10 bg-[#0b1d4d] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Save
                </button>
              </form>

              <div className="mt-4 space-y-2">
                {terms.map((term) => (
                  <div key={term.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm font-medium text-white">{term.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTermModal(term.id, term.name)}
                        className="rounded-md border border-cyan-400/20 px-2 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal("term", term.id, term.name)}
                        className="rounded-md border border-rose-400/20 px-2 py-1 text-xs font-semibold text-rose-200 transition hover:bg-white/5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {terms.length === 0 ? <p className="text-sm text-white/55">No terms yet.</p> : null}
              </div>
            </section>
          ) : null}

          {canManage ? (
            <section className="rounded-[1.5rem] border border-white/10 bg-[#08183d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Join requests</h3>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {joinRequests.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {joinRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-[#0b1f56] p-4 text-sm shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-white">{displayMemberName(request)}</p>
                      <div className="flex items-center gap-2">
                        {request.student_role && (
                          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold capitalize text-white/80">{request.student_role}</span>
                        )}
                        {request.requested_role && (
                          <span className="rounded-md bg-cyan-400/10 px-2 py-1 text-xs font-semibold capitalize text-cyan-200">join as {request.requested_role}</span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-white/55">Requested: {new Date(request.created_at).toLocaleString()}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleJoinRequest(request.id, "approved")}
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJoinRequest(request.id, "rejected")}
                        className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {joinRequests.length === 0 ? <p className="text-sm text-white/55">No pending requests.</p> : null}
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      {ownerLeaveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#08183d] p-5 text-white shadow-xl">
            <h3 className="text-lg font-semibold text-white">Leave owner class</h3>
            <p className="mt-2 text-sm text-white/65">
              Transfer ownership to another teacher member, or delete the class if you do not want to pass ownership.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Transfer ownership to
              </label>
              <select
                value={ownershipTargetId}
                onChange={(e) => setOwnershipTargetId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b1d4d] px-3 py-2 text-sm text-white"
              >
                <option value="">Select teacher member</option>
                {ownershipCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              {ownershipCandidates.length === 0 ? (
                <p className="text-xs text-amber-200">
                  No teacher member is available to receive ownership.
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void transferOwnershipAndLeave()}
                disabled={ownerActionLoading || ownershipCandidates.length === 0}
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ownerActionLoading ? "Saving..." : "Transfer and leave"}
              </button>
              <button
                type="button"
                onClick={() => void deleteClassAsOwner()}
                disabled={ownerActionLoading}
                className="rounded-lg border border-rose-400/20 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ownerActionLoading ? "Working..." : "Delete class"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOwnerLeaveModalOpen(false)}
              disabled={ownerActionLoading}
              className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}


      {editingTerm ? (
        <div className="fixed inset-0 z-70 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close edit term modal"
            onClick={() => {
              if (!savingEditTerm) {
                setEditingTerm(null);
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-zinc-900">Edit term</h4>
            <p className="mt-1 text-sm text-zinc-600">Update the term label for this class.</p>

            <form onSubmit={submitEditTerm} className="mt-4 space-y-3">
              <input
                autoFocus
                required
                value={editTermName}
                onChange={(e) => setEditTermName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Term name"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  disabled={savingEditTerm}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditTerm}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingEditTerm ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-70 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close delete confirmation modal"
            onClick={() => {
              if (!deletingItem) {
                setDeleteTarget(null);
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-zinc-900">Delete {deleteTarget.kind}</h4>
            <p className="mt-1 text-sm text-zinc-600">
              {deleteTarget.kind === "term"
                ? `Delete term "${deleteTarget.label}"? This will also delete tests under this term.`
                : `Delete test "${deleteTarget.label}"? This will also remove submissions and questions.`}
            </p>

            {deleteError ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">{deleteError}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingItem}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTarget()}
                disabled={deletingItem}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingItem ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
