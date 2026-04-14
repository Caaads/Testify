"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClassSearchQuery } from "@/components/AppShell";

type MemberItem = {
  id: string;
  name: string;
  role: "teacher" | "student";
  joinedAt: string | null;
  isOwner: boolean;
};

export function ClassMembersClient({
  classId,
  members,
  canManage,
  currentUserId,
}: {
  classId: string;
  members: MemberItem[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchQuery = useClassSearchQuery();
  const [message, setMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) => {
      return (
        member.name.toLowerCase().includes(normalizedSearch) ||
        member.role.toLowerCase().includes(normalizedSearch) ||
        (member.isOwner ? "owner" : "").includes(normalizedSearch)
      );
    });
  }, [members, normalizedSearch]);

  async function removeMember(memberId: string) {
    if (!canManage || memberId === currentUserId) {
      return;
    }

    setRemovingId(memberId);
    const response = await fetch("/api/classes/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId: memberId }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(payload.error || "Unable to remove member.");
      setRemovingId(null);
      return;
    }

    setMessage(payload.message || "Member removed.");
    setRemovingId(null);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Members</h3>
      </div>

      {message ? <p className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      <div className="space-y-2">
        {filteredMembers.map((member) => (
          <div key={member.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-zinc-900">{member.name}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                {member.isOwner ? "Owner" : member.role}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {member.joinedAt ? `Joined: ${new Date(member.joinedAt).toLocaleString()}` : "Class owner"}
            </p>
            {canManage && !member.isOwner && member.id !== currentUserId ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void removeMember(member.id)}
                  disabled={removingId === member.id}
                  className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removingId === member.id ? "Removing..." : "Kick"}
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {filteredMembers.length === 0 ? (
          <p className="text-sm text-zinc-500">No members found.</p>
        ) : null}
      </div>
    </section>
  );
}
