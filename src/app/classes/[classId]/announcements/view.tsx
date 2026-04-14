"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useClassSearchQuery } from "@/components/AppShell";

type Announcement = {
  id: string;
  content: string | null;
  created_at: string;
  created_by?: string | null;
  creator_name?: string | null;
};

export function ClassAnnouncementsClient({ classId, canPost }: { classId: string; canPost: boolean }) {
  const searchQuery = useClassSearchQuery();
  const [content, setContent] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredAnnouncements = useMemo(() => {
    if (!normalizedSearch) {
      return announcements;
    }

    return announcements.filter((item) =>
      (item.content || "").toLowerCase().includes(normalizedSearch),
    );
  }, [announcements, normalizedSearch]);

  async function loadAnnouncements() {
    const response = await fetch(`/api/announcements?classId=${classId}`);
    const data = (await response.json()) as {
      error?: string;
      announcements?: Announcement[];
    };

    if (!response.ok) {
      setMessage(data.error || "Unable to load announcements.");
      return;
    }

    setAnnouncements(data.announcements || []);
  }

  useEffect(() => {
    void loadAnnouncements();
    const timer = window.setInterval(() => {
      void loadAnnouncements();
    }, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function createAnnouncement(event: FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, content }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to create announcement.");
      return;
    }

    setContent("");
    setMessage(data.message || "Announcement posted.");
    void loadAnnouncements();
  }

  function openEditAnnouncementModal(item: Announcement) {
    setEditingAnnouncement(item);
    setEditContent(item.content || "");
  }

  async function submitEditAnnouncement(event: FormEvent) {
    event.preventDefault();

    if (!editingAnnouncement) {
      return;
    }

    const nextContent = editContent.trim();
    if (!nextContent) {
      setMessage("Announcement content is required.");
      return;
    }

    if (nextContent === (editingAnnouncement.content || "").trim()) {
      setEditingAnnouncement(null);
      return;
    }

    setSavingEdit(true);

    const response = await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: editingAnnouncement.id, content: nextContent }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    setSavingEdit(false);

    if (!response.ok) {
      setMessage(data.error || "Unable to update announcement.");
      return;
    }

    setMessage(data.message || "Announcement updated.");
    setEditingAnnouncement(null);
    void loadAnnouncements();
  }

  function openDeleteAnnouncementModal(item: Announcement) {
    setDeletingAnnouncement(item);
  }

  async function confirmDeleteAnnouncement() {
    if (!deletingAnnouncement) {
      return;
    }

    setDeleting(true);
    const response = await fetch("/api/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: deletingAnnouncement.id }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    setDeleting(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to delete announcement.");
      return;
    }

    setMessage(data.message || "Announcement deleted.");
    setDeletingAnnouncement(null);
    void loadAnnouncements();
  }

  return (
    <div className="space-y-4">
      {canPost ? (
        <form onSubmit={createAnnouncement} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label htmlFor="content" className="mb-2 block text-sm font-medium text-zinc-700">
            New announcement
          </label>
          <textarea
            id="content"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Post announcement
          </button>
        </form>
      ) : null}

      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      <section className="space-y-3">
        {filteredAnnouncements.map((item) => (
          <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-700">{item.content}</p>
            <p className="mt-2 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Created by: {item.creator_name || "Unknown creator"}</p>
            {canPost ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditAnnouncementModal(item)}
                  className="rounded-md border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteAnnouncementModal(item)}
                  className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {filteredAnnouncements.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            No announcements found.
          </p>
        ) : null}
      </section>

      {editingAnnouncement ? (
        <div className="fixed inset-0 z-70 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close edit announcement modal"
            onClick={() => {
              if (!savingEdit) {
                setEditingAnnouncement(null);
              }
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-zinc-900">Edit announcement</h4>
            <p className="mt-1 text-sm text-zinc-600">Update the announcement content.</p>

            <form onSubmit={submitEditAnnouncement} className="mt-4 space-y-3">
              <textarea
                autoFocus
                required
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-28 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAnnouncement(null)}
                  disabled={savingEdit}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingAnnouncement ? (
        <div className="fixed inset-0 z-70 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close delete announcement modal"
            onClick={() => {
              if (!deleting) {
                setDeletingAnnouncement(null);
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-zinc-900">Delete announcement</h4>
            <p className="mt-1 text-sm text-zinc-600">Are you sure you want to delete this announcement?</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAnnouncement(null)}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAnnouncement()}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
