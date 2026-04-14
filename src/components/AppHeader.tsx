import Link from "next/link";
import { RoleBadge } from "@/components/RoleBadge";
import { SignOutButton } from "@/components/SignOutButton";
import type { UserRole } from "@/lib/supabase/types";

export function AppHeader({
  name,
  role,
}: {
  name: string;
  role: UserRole;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-col">
          <Link href="/dashboard" className="text-lg font-bold text-zinc-900">
            Testify
          </Link>
          <span className="text-xs text-zinc-500">Welcome, {name}</span>
        </div>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-2 sm:flex">
            <Link href="/classes" className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
              Classes
            </Link>
            <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
              Dashboard
            </Link>
            <Link href="/profile" className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
              Profile
            </Link>
            {role === "admin" ? (
              <Link
                href="/admin/teacher-approvals"
                className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Approvals
              </Link>
            ) : null}
          </nav>
          <RoleBadge role={role} />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
