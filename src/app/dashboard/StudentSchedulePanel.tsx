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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StudentSchedulePanel({ schedules }: { schedules: ScheduleItem[] }) {
  const now = new Date();
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(now));

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const monthDays = new Date(currentYear, currentMonth + 1, 0).getDate();

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
    <section className="grid items-stretch gap-4 lg:grid-cols-[0.96fr_1.04fr]">
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <div className="flex items-end justify-between gap-3">
          <h3 className="text-[1.1rem] font-semibold text-[var(--foreground)]">Calendar</h3>
          <span className="text-[0.98rem] font-normal text-[var(--muted)]">{monthName}</span>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((day) => (
            <div key={day} className="py-1.5">
              {day}
            </div>
          ))}

          {dayCells.map((day, idx) => {
            if (!day) {
              return <div key={`blank-${idx}`} className="h-10" />;
            }

            const dayKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasTest = scheduleDayKeys.has(dayKey);
            const isToday = day === now.getDate();
            const isSelected = dayKey === selectedDateKey;

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => setSelectedDateKey(dayKey)}
                className={[
                  "relative flex h-10 items-center justify-center rounded-[0.7rem] border text-sm transition",
                  hasTest ? "border-sky-500/40 bg-sky-950/20 text-sky-100" : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]",
                  isToday ? "font-semibold" : "",
                  isSelected ? "border-sky-500 bg-white text-sky-700 shadow-[0_0_0_1px_rgba(14,165,233,0.18)]" : "",
                ].join(" ")}
                title={hasTest ? "Has scheduled test" : "No test schedule"}
              >
                {day}
                {hasTest ? (
                  <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(15,23,42,0.25)]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-[var(--muted)]">Tap a day to filter schedules. Highlighted dates have scheduled test openings.</p>
      </article>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <h3 className="max-w-[14ch] text-[1.1rem] font-semibold leading-tight text-[var(--foreground)]">
          Schedule on {formatHeaderDate(selectedDateKey)}
        </h3>

        <div className="mt-5 space-y-3">
          {schedulesForSelectedDay.map((test) => (
            <Link
              key={test.id}
              href={`/quizzes/${test.id}`}
              className="block rounded-[1rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
            >
              <p className="font-semibold text-[var(--foreground)]">{test.title}</p>
              <p className="mt-1 text-[var(--muted)]">{test.className || "Class"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Opens: {formatDateTime(test.opensAt)}</p>
              <p className="text-xs text-[var(--muted)]">Closes: {formatDateTime(test.closesAt)}</p>
            </Link>
          ))}

          {schedulesForSelectedDay.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No schedules for this day.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
