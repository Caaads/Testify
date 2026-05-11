"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleBadge } from "@/components/RoleBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/supabase/types";

const CLASS_SEARCH_EVENT = "testify-class-search-change";
let classSearchQuery = "";

function setClassSearchQuery(nextQuery: string) {
  classSearchQuery = nextQuery;
  window.dispatchEvent(new CustomEvent(CLASS_SEARCH_EVENT, { detail: nextQuery }));
}

export function useClassSearchQuery() {
  const [query, setQuery] = useState(classSearchQuery);

  useEffect(() => {
    const handleSearchChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setQuery(String(customEvent.detail || ""));
    };

    window.addEventListener(CLASS_SEARCH_EVENT, handleSearchChange);
    return () => window.removeEventListener(CLASS_SEARCH_EVENT, handleSearchChange);
  }, []);

  return query;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
  dropdown?: boolean;
};

type UserClass = {
  id: string;
  name: string;
  role: string;
};

const baseNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 9l7-4" />
      </svg>
    ),
    match: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/classes",
    label: "Classes",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    match: (pathname) => pathname === "/classes",
  },
  {
    href: "/classes",
    label: "Your classes",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4.5L3 9l8 4.5L19 9l-8-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v4m0 0c2.5 1.5 5.5 2.5 7 2.5S16.5 15.5 19 14v-4" />
      </svg>
    ),
    match: (pathname) => pathname.startsWith("/classes") || pathname.startsWith("/quizzes"),
    dropdown: true,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    match: (pathname) => pathname.startsWith("/profile"),
  },
];

const adminNav: NavItem = {
  href: "/admin/teacher-approvals",
  label: "Teacher Approvals",
  icon: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  match: (pathname) => pathname.startsWith("/admin/teacher-approvals"),
};

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white shadow-sm">
      {initials || "U"}
    </div>
  );
}

export function AppShell({
  name,
  role,
  title,
  subtitle,
  children,
}: {
  name: string;
  role: UserRole;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showHeaderSearch = pathname === "/classes" || pathname.startsWith("/classes/");
  const nav = role === "admin" ? [...baseNav, adminNav] : baseNav;
  const [showUserModal, setShowUserModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userClasses, setUserClasses] = useState<UserClass[]>([]);
  const [showClassesDropdown, setShowClassesDropdown] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [pingOnline, setPingOnline] = useState(true);
  const [showHeaderSearchInput, setShowHeaderSearchInput] = useState(Boolean(classSearchQuery));
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then((result: { data: { user: { email?: string } | null } }) => {
      setUserEmail(result.data.user?.email || "No email available");
    });
  }, []);

  useEffect(() => {
    const fetchClasses = async () => {
      const supabase = createClient();
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;

      if (!userId) {
        setUserClasses([]);
        return;
      }

      const [{ data: joinedClasses }, { data: ownedClasses }] = await Promise.all([
        supabase
          .from("class_students")
          .select("class_id, joined_at, classes!inner(id, name)")
          .eq("student_id", userId)
          .order("joined_at", { ascending: false }),
        supabase
          .from("classes")
          .select("id, name, created_at")
          .eq("teacher_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      const merged = new Map<string, UserClass>();

      (ownedClasses ?? []).forEach((item: { id: string; name: string }) => {
        merged.set(item.id, { id: item.id, name: item.name, role: "teacher" });
      });

      (joinedClasses ?? []).forEach((item: { class_id: string; classes: { id: string; name: string } }) => {
        merged.set(item.class_id, {
          id: item.classes.id,
          name: item.classes.name,
          role: "student",
        });
      });

      setUserClasses(
        Array.from(merged.values()).sort((left, right) => {
          const nameCompare = left.name.localeCompare(right.name);
          if (nameCompare !== 0) {
            return nameCompare;
          }

          if (left.role !== right.role) {
            return left.role.localeCompare(right.role);
          }

          return left.id.localeCompare(right.id);
        }),
      );
    };

    void fetchClasses();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkPing = async () => {
      const start = performance.now();
      try {
        const response = await fetch(`/api/classes?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (cancelled) {
          return;
        }

        setPingOnline(response.ok || response.status === 401 || response.status === 403);
        setPingMs(Math.round(performance.now() - start));
      } catch {
        if (!cancelled) {
          setPingOnline(false);
          setPingMs(null);
        }
      }
    };

    void checkPing();
    const timer = setInterval(() => {
      void checkPing();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (showHeaderSearchInput) {
      searchInputRef.current?.focus();
    }
  }, [showHeaderSearchInput]);

  return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg hover:bg-[var(--surface-elevated)] p-2 transition"
                aria-label="Toggle sidebar"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--surface-elevated)]">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm">
                  <span className="text-xs font-black">T</span>
                </div>
                <span className="hidden text-lg font-semibold sm:inline">Testify</span>
              </Link>
            </div>
            <div className="flex-1 min-w-[220px]">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-[var(--muted)]">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {showHeaderSearch ? (
                <div className="relative flex items-center">
                  {showHeaderSearchInput ? (
                    <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-sm">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        ref={searchInputRef}
                        defaultValue={classSearchQuery}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setClassSearchQuery(nextValue);
                        }}
                        placeholder={pathname.startsWith("/classes/") ? "Search tests, announcements, members" : "Search classes"}
                        className="w-40 bg-transparent text-sm text-[var(--foreground)] outline-none sm:w-52"
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      const next = !showHeaderSearchInput;
                      setShowHeaderSearchInput(next);
                      if (!next) {
                        return;
                      }

                      window.requestAnimationFrame(() => {
                        searchInputRef.current?.focus();
                      });
                    }}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl border transition",
                      showHeaderSearchInput
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                    aria-label={showHeaderSearchInput ? "Hide class search" : "Show class search"}
                    title={showHeaderSearchInput ? "Hide search" : "Show search"}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
              <div
                className={cn(
                  "hidden items-center gap-2 rounded-xl border px-3 py-2 text-sm sm:inline-flex",
                  pingOnline
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-rose-300 bg-rose-50 text-rose-700",
                )}
                title={pingOnline ? "Connection healthy" : "Connection unavailable"}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    pingOnline ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                <span>{pingOnline ? `Ping ${pingMs ?? "--"} ms` : "Offline"}</span>
              </div>
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <div className="hidden sm:block">
                <RoleBadge role={role} />
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="hidden rounded-full ring-sky-300 transition hover:ring-2 sm:inline-flex"
                aria-label="Open profile quick view"
              >
                <UserAvatar name={name} />
              </button>
              <div className="hidden sm:block">
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-screen w-full max-w-[1600px]">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-[85px] z-30 h-[calc(100vh-85px)] w-64 flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(true)}
                  className="rounded-full ring-sky-300 transition hover:ring-2 sm:hidden"
                  aria-label="Open profile quick view"
                >
                  <UserAvatar name={name} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{name}</p>
                  <p className="text-xs capitalize text-[var(--muted)]">{role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg hover:bg-[var(--surface-elevated)] p-2 transition"
                aria-label="Close sidebar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  pingOnline
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-rose-300 bg-rose-50 text-rose-700",
                )}
                title={pingOnline ? "Connection healthy" : "Connection unavailable"}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    pingOnline ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                <span>{pingOnline ? `Ping ${pingMs ?? "--"} ms` : "Offline"}</span>
              </div>
              <RoleBadge role={role} />
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-0 px-2 py-2">
            {nav.map((item) => {
              const active = item.dropdown
                ? pathname.startsWith("/classes/") || pathname.startsWith("/quizzes")
                : item.match(pathname);
              const isDropdown = item.dropdown;

              return (
                <div key={`${item.href}-${item.label}`}>
                  {isDropdown ? (
                    <button
                      type="button"
                      onClick={() => setShowClassesDropdown(!showClassesDropdown)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                          : "text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg
                        className={cn("h-4 w-4 transition-transform", showClassesDropdown ? "rotate-180" : "rotate-0")}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10l-7 7-7-7" />
                      </svg>
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                          : "text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )}

                  {isDropdown && showClassesDropdown && (
                    <div className="mt-0 ml-4 border-l border-[var(--border)] pl-3 space-y-0 py-1">
                      {userClasses.length > 0 ? (
                        userClasses.map((classItem) => {
                          const classPath = `/classes/${classItem.id}`;
                          const isClassActive =
                            pathname === classPath || pathname.startsWith(`${classPath}/`);

                          return (
                            <Link
                              key={classItem.id}
                              href={classPath}
                              className={cn(
                                "block rounded-md px-3 py-2 text-xs transition",
                                isClassActive
                                  ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                                  : "text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
                              )}
                              onClick={() => {
                                setSidebarOpen(false);
                                setShowClassesDropdown(false);
                              }}
                            >
                              {classItem.name}
                            </Link>
                          );
                        })
                      ) : (
                        <p className="px-3 py-2 text-xs text-[var(--muted)]">No classes yet</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-[var(--border)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Support</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Need help? Check class analytics, approvals, and logs from the dashboard.</p>
          </div>
        </aside>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed left-0 right-0 top-[85px] bottom-0 z-20 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex min-h-full flex-col">
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>

      {showUserModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Profile quick view</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Account details</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close profile quick view"
              >
                X
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Name</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>
              <p className="pt-2 text-sm text-zinc-500 dark:text-zinc-400">Email</p>
              <p className="text-sm font-semibold text-zinc-900 break-all dark:text-white">{userEmail}</p>
            </div>
          </div>
        </div>
      ) : null}
      </div>
  );
}
