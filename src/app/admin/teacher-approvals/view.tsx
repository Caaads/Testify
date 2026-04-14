"use client";

import { useState } from "react";

type TeacherRequest = {
  id: string;
  full_name: string | null;
  role: string;
  teacher_status: string;
  created_at: string;
};

export function TeacherApprovalsClient({
  initialRequests,
}: {
  initialRequests: TeacherRequest[];
}) {
  const [requests, setRequests] = useState<TeacherRequest[]>(initialRequests);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRequests() {
    const response = await fetch("/api/teacher-approvals");
    const data = (await response.json()) as {
      error?: string;
      requests?: TeacherRequest[];
    };

    if (!response.ok) {
      setMessage(data.error || "Unable to load pending teachers.");
      return;
    }

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

    setMessage(data.message || "Teacher request updated.");
    void loadRequests();
  }

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
            <h2 className="text-xl font-bold text-[var(--foreground)]">Pending Registrations</h2>
            <p className="text-sm text-[var(--muted)]">Review and approve new educator applications.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {requests.length} pending
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Educator</th>
                <th className="px-4 py-3">Applied Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{request.full_name || "Unnamed teacher"}</p>
                    <p className="text-xs text-[var(--muted)]">Role: {request.role}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{new Date(request.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(request.id, "approved")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(request.id, "rejected")}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/20"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {requests.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                    No pending teacher approvals.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Recent System Logs</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li>Admin approved teacher accounts in the last hour.</li>
            <li>Security checks are active for sign-in attempts.</li>
            <li>Database sync status is healthy.</li>
          </ul>
        </article>

        <article className="rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-700 p-5 text-blue-50 shadow-[var(--shadow)]">
          <h3 className="text-lg font-bold">Teacher Growth</h3>
          <p className="mt-2 text-sm text-blue-100/90">
            Your community is growing steadily as more educators onboard to Testify.
          </p>
          <div className="mt-4 grid grid-cols-6 items-end gap-2">
            {[28, 42, 34, 58, 70, 88].map((value, index) => (
              <div key={index} className="rounded-md bg-white/20" style={{ height: `${value}px` }} />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
