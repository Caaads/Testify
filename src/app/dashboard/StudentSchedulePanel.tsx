"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ScheduleItem = {
  id: string;
  title: string;
  className: string;
  opensAt: string | null;
  closesAt: string | null;
};

function toDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No schedule";
  }
  return new Date(value).toLocaleString();
}

function formatHeaderDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTimeRange(opensAt: string | null, closesAt: string | null) {
  if (!opensAt) return "";
  const open = new Date(opensAt);
  const close = closesAt ? new Date(closesAt) : null;
  
  const openStr = open.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  
  if (close) {
    const closeStr = close.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${openStr} - ${closeStr}`;
  }
  
  return openStr;
}

export function StudentSchedulePanel({ schedules }: { schedules: ScheduleItem[] }) {
  const now = new Date();
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(now));
  const [navMonth, setNavMonth] = useState(now.getMonth());
  const [navYear, setNavYear] = useState(now.getFullYear());

  const currentYear = navYear;
  const currentMonth = navMonth;
  const monthName = new Date(navYear, navMonth, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const monthDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setNavMonth(11);
      setNavYear(currentYear - 1);
    } else {
      setNavMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setNavMonth(0);
      setNavYear(currentYear + 1);
    } else {
      setNavMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setSelectedDateKey(toDateKey(now));
    setNavMonth(now.getMonth());
    setNavYear(now.getFullYear());
  };

  const scheduleDayKeys = useMemo(
    () =>
      new Set(
        schedules
          .map((item) => (item.opensAt ? toDateKey(item.opensAt) : null))
          .filter((key): key is string => Boolean(key)),
      ),
    [schedules],
  );

  const dayCells: Array<number | null> = [
    ...Array.from({ length: firstDayIndex }, () => null),
    ...Array.from({ length: monthDays }, (_, idx) => idx + 1),
  ];

  const schedulesForSelectedDay = useMemo(() => {
    return schedules.filter((item) => {
      if (!item.opensAt) {
        return false;
      }
      return toDateKey(item.opensAt) === selectedDateKey;
    });
  }, [schedules, selectedDateKey]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <h2 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">My Schedule</h2>
      
      <div className="grid gap-6 lg:grid-cols-[1fr_1px_1fr]">
        {/* Calendar Section */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)]"
              title="Previous month"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="flex-1 text-center text-lg font-semibold text-[var(--foreground)]">{monthName}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)]"
              title="Next month"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="ml-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)]"
              title="Go to today"
            >
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}

            {dayCells.map((day, idx) => {
              if (!day) {
                return <div key={`blank-${idx}`} className="h-10" />;
              }

              const dayKey = `${navYear}-${String(navMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasTest = scheduleDayKeys.has(dayKey);
              const isToday = day === now.getDate() && now.getMonth() === navMonth && now.getFullYear() === navYear;
              const isSelected = dayKey === selectedDateKey;

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDateKey(dayKey)}
                  className={[
                    "relative flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition",
                    isSelected
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-100"
                      : hasTest
                        ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                        : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]",
                    isToday ? "font-bold" : "",
                  ].join(" ")}
                  title={hasTest ? "Has scheduled test" : "No test schedule"}
                >
                  {day}
                  {hasTest ? (
                    <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="bg-[var(--border)]" />

        {/* Schedule Section */}
        <div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Selected Day</p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
              {formatHeaderDate(selectedDateKey)}
            </h3>
          </div>

          <div className="space-y-4">
            {schedulesForSelectedDay.map((test) => (
              <Link
                key={test.id}
                href={`/quizzes/${test.id}`}
                className="block rounded-xl border border-sky-500/20 bg-[#0b2138] p-4 text-white transition hover:border-sky-400/40 hover:bg-[#0d2645]"
              >
                <p className="text-xs font-semibold text-sky-300">{formatTimeRange(test.opensAt, test.closesAt)}</p>
                <p className="mt-2 font-semibold text-white">{test.title}</p>
                <p className="mt-1 text-sm text-white/70">{test.className || "Class"}</p>
              </Link>
            ))}

            {schedulesForSelectedDay.length === 0 ? (
              <div className="rounded-xl border border-sky-500/10 bg-[#0b2138] p-4 text-center">
                <p className="text-sm text-sky-300">No tests scheduled for this day.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
