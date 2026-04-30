"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Class overview</h2>
        <p className="mt-2 text-sm text-zinc-600">{classDescription || "No class description yet."}</p>
        <p className="mt-1 text-xs text-zinc-500">Created by: {classCreatorName}</p>
        {canLeave ? (
          <button
            type="button"
            onClick={leaveClass}
            className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            Leave class
          </button>
        ) : null}
        {isOwner ? (
          <button
            type="button"
            onClick={() => setOwnerLeaveModalOpen(true)}
            className="mt-3 ml-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
          >
            Leave owner class
          </button>
        ) : null}
      </section>

      {ownerLeaveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Leave owner class</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Transfer ownership to another teacher member, or delete the class if you do not want to pass ownership.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Transfer ownership to
              </label>
              <select
                value={ownershipTargetId}
                onChange={(e) => setOwnershipTargetId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select teacher member</option>
                {ownershipCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              {ownershipCandidates.length === 0 ? (
                <p className="text-xs text-amber-700">
                  No teacher member is available to receive ownership.
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void transferOwnershipAndLeave()}
                disabled={ownerActionLoading || ownershipCandidates.length === 0}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ownerActionLoading ? "Saving..." : "Transfer and leave"}
              </button>
              <button
                type="button"
                onClick={() => void deleteClassAsOwner()}
                disabled={ownerActionLoading}
                className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ownerActionLoading ? "Working..." : "Delete class"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOwnerLeaveModalOpen(false)}
              disabled={ownerActionLoading}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-1">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Latest announcements</h3>
          <div className="mt-3 space-y-3">
            {filteredAnnouncements.map((item) => (
              <article key={item.id} className="rounded-2xl border border-sky-500/20 bg-[#0b1f56] p-4 text-white shadow-sm">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cyan-100">{className}</p>
                  <p className="mt-1 text-xs text-white/70">by {item.creator_name || classCreatorName}</p>
                  <p className="mt-3 text-sm text-white/90">{item.content}</p>
                  <p className="mt-3 text-xs text-white/60">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </article>
            ))}
            {filteredAnnouncements.length === 0 ? <p className="text-sm text-zinc-500">No announcements found.</p> : null}
          </div>
        </article>
      </section>

      {canManage ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Join requests</h3>
            <div className="mt-3 space-y-2">
              {joinRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-zinc-900">{displayMemberName(request)}</p>
                    <div className="flex items-center gap-2">
                      {request.student_role && (
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold capitalize text-zinc-800">{request.student_role}</span>
                      )}
                      {request.requested_role && (
                        <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold capitalize text-sky-800">join as {request.requested_role}</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Requested: {new Date(request.created_at).toLocaleString()}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleJoinRequest(request.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJoinRequest(request.id, "rejected")}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {joinRequests.length === 0 ? (
                <p className="text-sm text-zinc-500">No pending requests.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Create term</h3>
            <form onSubmit={createTerm} className="mt-3 flex gap-2">
              <input
                required
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="ex. 1st grading, Prelim, etc."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Save
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {terms.map((term) => (
                <div key={term.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-800">{term.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditTermModal(term.id, term.name)}
                      className="rounded-md border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal("term", term.id, term.name)}
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {terms.length === 0 ? (
                <p className="text-sm text-zinc-500">No terms yet.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Tests</h3>

        {canManage ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm text-zinc-700">Create tests from the dedicated builder page.</p>
            {terms.length > 0 ? (
              <Link
                href={`/classes/${classId}/quizzes/create`}
                className="mt-2 inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Open test builder
              </Link>
            ) : (
              <p className="mt-2 text-xs text-amber-700">Create a term first before making a test.</p>
            )}
          </div>
        ) : null}

        <div className="mt-4 space-y-5">
          {testsByTerm.map((termSection) => (
            <div key={termSection.id} className="space-y-2">
              <h4 className="text-xl font-semibold tracking-wide text-sky-700 uppercase">{termSection.name}</h4>

              {termSection.tests.map((quiz) => (
                <div key={quiz.id} className="rounded-lg border border-zinc-200 p-3 relative">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-900">{quiz.title}</p>
                      <p className="text-sm text-zinc-600">
                        Duration: {quiz.duration || 0} min | Total: {quiz.total_score}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Opens: {quiz.opens_at ? new Date(quiz.opens_at).toLocaleString() : "Anytime"} | Closes: {quiz.closes_at ? new Date(quiz.closes_at).toLocaleString() : "No close"}
                      </p>
                      <p className="text-xs text-zinc-500">Created by: {quiz.profiles?.[0]?.full_name || classCreatorName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                      >
                        Open test
                      </Link>
                      {canManage ? (
                        <>
                          <Link
                            href={`/quizzes/${quiz.id}/review`}
                            className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Review test submissions
                          </Link>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuQuizId(openMenuQuizId === quiz.id ? null : quiz.id)}
                              className="rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-50"
                              title="More options"
                              aria-label="Open test options"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.8" />
                                <circle cx="12" cy="12" r="1.8" />
                                <circle cx="12" cy="19" r="1.8" />
                              </svg>
                            </button>
                            {openMenuQuizId === quiz.id ? (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuQuizId(null)} />
                                <div className="absolute right-0 bottom-full mb-1 z-50 min-w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                                  <Link
                                    href={`/classes/${classId}/quizzes/${quiz.id}/edit`}
                                    className="block border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuQuizId(null);
                                      openDeleteModal("test", quiz.id, quiz.title);
                                    }}
                                    className="w-full border-b border-zinc-200 px-4 py-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuQuizId(null);
                                      void toggleAutoScore(quiz.id, !quiz.allow_auto_score);
                                    }}
                                    className="w-full border-b border-zinc-200 px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                                  >
                                    <span className="font-semibold">Auto score:</span> {quiz.allow_auto_score ? "Visible" : "Hidden"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuQuizId(null);
                                      void toggleReview(quiz.id, !quiz.allow_review);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                                  >
                                    <span className="font-semibold">Student review:</span> {quiz.allow_review ? "Enabled" : "Disabled"}
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {termSection.tests.length === 0 ? (
                <p className="text-sm text-zinc-500">No tests in this term yet.</p>
              ) : null}
            </div>
          ))}

          {testsByTerm.every((section) => section.tests.length === 0) ? <p className="text-sm text-zinc-500">No tests found.</p> : null}
        </div>
      </section>

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
