"use client";

import Link from "next/link";
import { CiCirclePlus } from "react-icons/ci";

export function ActionTile({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[194px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)]/85 p-6 text-center shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)]"
    >
      <CiCirclePlus className="h-14 w-14 text-[var(--muted)]" />
      <p className="mt-4 text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
    </Link>
  );
}
