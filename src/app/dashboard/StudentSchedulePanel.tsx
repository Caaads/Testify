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
    <section className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">Calendar</h3>
          <span className="text-sm text-zinc-500">{monthName}</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2 font-semibold">
              {day}
            </div>
          ))}
          {dayCells.map((day, idx) => {
            if (!day) {
              return <div key={`blank-${idx}`} className="h-9" />;
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
                  "flex h-9 items-center justify-center rounded-md border text-sm transition",
                  hasTest ? "border-sky-300 bg-sky-50 text-sky-800" : "border-transparent",
                  isToday ? "font-bold ring-1 ring-emerald-400" : "",
                  isSelected ? "ring-2 ring-sky-500" : "",
                ].join(" ")}
                title={hasTest ? "Has scheduled test" : "No test schedule"}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">Tap a day to filter schedules. Highlighted dates have scheduled test openings.</p>
      </article>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <h3 className="text-lg font-semibold text-zinc-900">Schedule on {formatHeaderDate(selectedDateKey)}</h3>
        <div className="mt-4 space-y-2">
          {schedulesForSelectedDay.map((test) => (
            <Link
              key={test.id}
              href={`/quizzes/${test.id}`}
              className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
            >
              <p className="font-semibold text-zinc-900">{test.title}</p>
              <p className="text-zinc-600">{test.className || "Class"}</p>
              <p className="text-xs text-zinc-500">Opens: {formatDateTime(test.opensAt)}</p>
              <p className="text-xs text-zinc-500">Closes: {formatDateTime(test.closesAt)}</p>
            </Link>
          ))}

          {schedulesForSelectedDay.length === 0 ? (
            <p className="text-sm text-zinc-500">No schedules for this day.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
