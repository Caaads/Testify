"use client";

import { useMemo, useState } from "react";

type TeacherRequest = {
  id: string;
  full_name: string | null;
  role: string;
  teacher_status: string;
  created_at: string;
};

type Teacher = TeacherRequest;

export function TeacherApprovalsClient({
  initialTeachers,
  initialRequests,
}: {
  initialTeachers: Teacher[];
  initialRequests: TeacherRequest[];
}) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [requests, setRequests] = useState<TeacherRequest[]>(initialRequests);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{
    teacherId: string | null;
    action: "demote" | "remove" | null;
    title: string;
    message: string;
  }>({ teacherId: null, action: null, title: "", message: "" });

  async function loadAll() {
    const response = await fetch("/api/teacher-approvals");
    const data = (await response.json()) as {
      error?: string;
      teachers?: Teacher[];
      requests?: TeacherRequest[];
    };

    if (!response.ok) {
      setMessage(data.error || "Unable to load teachers.");
      return;
    }

    setTeachers(data.teachers || []);
    setRequests(data.requests || []);
  }

  async function handleAction(teacherId: string, action: "approved" | "rejected") {
    const response = await fetch("/api/teacher-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, action }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to update teacher status.");
      return;
    }

    setMessage(data.message || "Teacher status updated.");
    void loadAll();
  }

  function openConfirm(teacherId: string, action: "demote" | "remove") {
    const title = action === "demote" ? "Demote teacher" : "Remove teacher";
    const message =
      action === "demote"
        ? "This will change the user role to student and remove educator access. Continue?"
        : "This will permanently remove the teacher account. This cannot be undone.";

    setConfirmProps({ teacherId, action, title, message });
    setConfirmOpen(true);
  }

  async function handleConfirmAction() {
    const teacherId = confirmProps.teacherId;
    const action = confirmProps.action;
    if (!teacherId || !action) return;

    const response = await fetch("/api/teacher-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, action }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to update teacher status.");
      setConfirmOpen(false);
      return;
    }

    setMessage(data.message || "Action completed.");
    setConfirmOpen(false);
    void loadAll();
  }

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => (t.full_name || "").toLowerCase().includes(q));
  }, [teachers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize));
  const paginatedTeachers = filteredTeachers.slice((page - 1) * pageSize, page * pageSize);
  const pendingCount = requests.length;

  return (
    <div className="app-enter space-y-4">
      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">All Teachers</h2>
            <p className="text-sm text-[var(--muted)]">Manage existing educator accounts.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              aria-label="Search teachers"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search educators..."
              className="rounded-md border px-3 py-1 text-sm"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {filteredTeachers.length} total · {pendingCount} pending
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Educator</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                    No teachers found.
                  </td>
                </tr>
              ) : null}

              {paginatedTeachers.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{t.full_name || "Unnamed teacher"}</p>
                    <p className="text-xs text-[var(--muted)]">Role: {t.role}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{t.teacher_status}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {t.teacher_status !== "approved" ? (
                        <button
                          type="button"
                          onClick={() => handleAction(t.id, "approved")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      ) : null}

                      {t.teacher_status !== "rejected" ? (
                        <button
                          type="button"
                          onClick={() => handleAction(t.id, "rejected")}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/20"
                        >
                          Reject
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => openConfirm(t.id, "demote")}
                        className="rounded-lg border border-yellow-400 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-yellow-700 hover:bg-yellow-50"
                      >
                        Demote
                      </button>

                      <button
                        type="button"
                        onClick={() => openConfirm(t.id, "remove")}
                        className="rounded-lg border border-rose-600 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-[var(--muted)]">Page {page} / {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border px-3 py-1 text-sm disabled:opacity-40">
              Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border px-3 py-1 text-sm disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <h3 className="text-lg font-bold text-[var(--foreground)]">{confirmProps.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{confirmProps.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border px-3 py-1 text-sm">Cancel</button>
              <button onClick={handleConfirmAction} className="rounded-md bg-rose-600 px-3 py-1 text-sm text-white">Confirm</button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
