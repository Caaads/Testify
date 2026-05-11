"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ReviewQuestion = {
  id: string;
  content: string | null;
  correct_answer: string | null;
  points: number;
  type: string;
};

type ReviewSubmission = {
  id: string;
  student_id: string;
  student_name?: string | null;
  score: number;
  status: string;
  answers: unknown;
  submitted_at: string;
  profiles: { full_name: string | null }[];
};

type AnswerEntry = {
  questionId: string;
  answer: string;
  awardedPoints?: number;
};

function parseCheckboxAnswer(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [] as string[];
  }
}

function parseExpectedAnswers(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // treat as single answer
  }

  return [trimmed];
}

function getAutoAwardedPoints(question: ReviewQuestion | undefined, rawAnswer: string) {
  if (!question) return 0;
  const points = Number(question.points || 1);
  const expected = String(question.correct_answer || "");
  const response = String(rawAnswer || "");

  if (question.type === "essay") {
    return 0;
  }

  if (question.type === "checkbox") {
    const expectedValues = parseCheckboxAnswer(expected).map((value) => value.toLowerCase()).sort();
    const responseValues = parseCheckboxAnswer(response).map((value) => value.toLowerCase()).sort();
    if (
      expectedValues.length > 0 &&
      expectedValues.length === responseValues.length &&
      expectedValues.every((value, index) => value === responseValues[index])
    ) {
      return points;
    }
    return 0;
  }

  const normalizedResponse = response.trim().toLowerCase();
  const candidates = parseExpectedAnswers(expected).map((value) => value.toLowerCase());
  if (normalizedResponse && candidates.includes(normalizedResponse)) {
    return points;
  }

  return 0;
}

export function QuizReviewClient({
  quizId,
  classId,
  className,
}: {
  quizId: string;
  classId: string;
  className: string;
}) {
  const [quizTitle, setQuizTitle] = useState("Test");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [returningSubmissionId, setReturningSubmissionId] = useState<string | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});

  async function loadData() {
    const response = await fetch(`/api/quizzes/review?quizId=${quizId}`);
    const data = (await response.json()) as {
      error?: string;
      quiz?: { id: string; title: string };
      questions?: ReviewQuestion[];
      submissions?: ReviewSubmission[];
    };

    if (!response.ok) {
      setMessage(data.error || "Unable to load review data.");
      return;
    }

    setQuizTitle(data.quiz?.title || "Test");
    setQuestions(data.questions || []);
    setSubmissions(data.submissions || []);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  const selectedSubmission = useMemo(
    () => submissions.find((item) => item.id === selectedSubmissionId) ?? null,
    [submissions, selectedSubmissionId],
  );

  useEffect(() => {
    if (submissions.length > 0 && !selectedSubmissionId) {
      setSelectedSubmissionId(submissions[0].id);
      return;
    }

    if (
      selectedSubmissionId &&
      submissions.length > 0 &&
      !submissions.some((item) => item.id === selectedSubmissionId)
    ) {
      setSelectedSubmissionId(submissions[0].id);
    }
  }, [submissions, selectedSubmissionId]);

  function getStudentName(submission: ReviewSubmission) {
    return submission.student_name || submission.profiles?.[0]?.full_name || "Unnamed Student";
  }

  async function saveScore(
    submissionId: string,
    score: number,
    status: string,
    questionScores?: Record<string, number>,
  ) {
    const response = await fetch("/api/quizzes/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, score, status, questionScores }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to update score.");
      return;
    }

    setMessage(data.message || "Score updated.");
    void loadData();
  }

  async function returnToStudent(submissionId: string) {
    const response = await fetch("/api/quizzes/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, action: "return" }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to return submission.");
      return;
    }

    setMessage(data.message || "Submission returned to student.");
    setReturningSubmissionId(null);
    void loadData();
  }

  const stats = useMemo(() => {
    const answers = Array.isArray(selectedSubmission?.answers)
      ? (selectedSubmission.answers as AnswerEntry[])
      : [];

    let passed = 0;
    let failed = 0;
    let notAttempted = questions.length - answers.length;

    answers.forEach((entry) => {
      const question = questionMap.get(entry.questionId);
      const awarded = Number(
        typeof entry.awardedPoints === "number"
          ? entry.awardedPoints
          : getAutoAwardedPoints(question, entry.answer || ""),
      );
      const isCorrect = awarded > 0;

      if (isCorrect) {
        passed++;
      } else {
        failed++;
      }
    });

    return { passed, failed, notAttempted, total: questions.length };
  }, [selectedSubmission, questions, questionMap]);

  useEffect(() => {
    if (!selectedSubmission) {
      setManualScores({});
      return;
    }

    const answers = Array.isArray(selectedSubmission.answers)
      ? (selectedSubmission.answers as AnswerEntry[])
      : [];

    const nextScores: Record<string, number> = {};
    for (const entry of answers) {
      const question = questionMap.get(entry.questionId);
      const maxPoints = Math.max(0, Number(question?.points ?? 0));
      const awarded =
        typeof entry.awardedPoints === "number"
          ? entry.awardedPoints
          : getAutoAwardedPoints(question, entry.answer || "");
      nextScores[entry.questionId] = Math.max(0, Math.min(maxPoints, Number(awarded) || 0));
    }

    setManualScores(nextScores);
  }, [selectedSubmission, questionMap]);

  const manualTotal = useMemo(() => {
    if (!selectedSubmission) return 0;
    const answers = Array.isArray(selectedSubmission.answers)
      ? (selectedSubmission.answers as AnswerEntry[])
      : [];

    return answers.reduce((sum, entry) => {
      return sum + Number(manualScores[entry.questionId] ?? 0);
    }, 0);
  }, [selectedSubmission, manualScores]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{quizTitle}</h2>
          <p className="text-sm text-zinc-500">Class: {className}</p>
        </div>
        <Link href={`/classes/${classId}`} className="text-sm font-semibold text-sky-700 hover:underline">
          Back to class
        </Link>
      </div>

      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      {submissions.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          No submissions yet.
        </p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">Students</h3>
            <div className="mt-3 space-y-2">
              {submissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedSubmissionId(submission.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedSubmissionId === submission.id
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <p className="font-semibold">{getStudentName(submission)}</p>
                  <p className="text-xs">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            {selectedSubmission ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{getStudentName(selectedSubmission)}</p>
                    <p className="text-xs text-zinc-500">
                      Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()} | Status: {selectedSubmission.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        const status = String(formData.get("status") ?? "graded");
                        void saveScore(selectedSubmission.id, manualTotal, status, manualScores);
                      }}
                    >
                      <input
                        name="score"
                        type="number"
                        min={0}
                        value={manualTotal}
                        readOnly
                        className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <select
                        name="status"
                        defaultValue={selectedSubmission.status === "ungraded" ? "ungraded" : "graded"}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="graded">Graded</option>
                        <option value="ungraded">Ungraded</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                    </form>
                    {returningSubmissionId === selectedSubmission.id ? (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-zinc-600">Return to student?</p>
                        <button
                          type="button"
                          onClick={() => void returnToStudent(selectedSubmission.id)}
                          className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setReturningSubmissionId(null)}
                          className="rounded-lg bg-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReturningSubmissionId(selectedSubmission.id)}
                        className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                      >
                        Return to Student
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-gradient-to-r from-zinc-50 to-zinc-100 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-zinc-900">Performance Summary</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-white p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{stats.passed}</p>
                      <p className="text-xs font-medium text-zinc-600">Passed</p>
                      <p className="text-[10px] text-zinc-500">{stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-center">
                      <p className="text-2xl font-bold text-rose-600">{stats.failed}</p>
                      <p className="text-xs font-medium text-zinc-600">Failed</p>
                      <p className="text-[10px] text-zinc-500">{stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}%</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-center">
                      <p className="text-2xl font-bold text-zinc-400">{stats.notAttempted}</p>
                      <p className="text-xs font-medium text-zinc-600">Not Attempted</p>
                      <p className="text-[10px] text-zinc-500">{stats.total > 0 ? Math.round((stats.notAttempted / stats.total) * 100) : 0}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${stats.total > 0 ? (stats.passed / stats.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-2 rounded-full bg-rose-500"
                      style={{ width: `${stats.total > 0 ? (stats.failed / stats.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-2 rounded-full bg-zinc-300"
                      style={{ width: `${stats.total > 0 ? (stats.notAttempted / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(Array.isArray(selectedSubmission.answers)
                    ? (selectedSubmission.answers as AnswerEntry[])
                    : []
                  ).map((entry, index) => {
                    const question = questionMap.get(entry.questionId);
                    const expected = (question?.correct_answer || "").trim();
                    const actual = (entry.answer || "").trim();
                    const maxPoints = Math.max(0, Number(question?.points ?? 0));
                    const awarded = Number(manualScores[entry.questionId] ?? 0);
                    const isCorrect = awarded >= maxPoints && maxPoints > 0;

                    return (
                      <div
                        key={`${selectedSubmission.id}-${entry.questionId}-${index}`}
                        className="rounded-lg border border-zinc-200 p-3 text-sm"
                      >
                        <p className="font-semibold text-zinc-900">{question?.content || "Question removed"}</p>
                        <p className="mt-1 text-zinc-700">Student answer: {actual || "No answer"}</p>
                        <p className="text-zinc-700">Correct answer: {expected || "N/A"}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs font-semibold text-zinc-600">Points</label>
                          <input
                            type="number"
                            min={0}
                            max={maxPoints}
                            step={0.5}
                            value={awarded}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              const safe = Number.isFinite(raw) ? raw : 0;
                              setManualScores((prev) => ({
                                ...prev,
                                [entry.questionId]: Math.max(0, Math.min(maxPoints, safe)),
                              }));
                            }}
                            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <span className="text-xs text-zinc-500">/ {maxPoints}</span>
                        </div>
                        <p className={`text-xs font-semibold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCorrect ? "Full points" : awarded > 0 ? "Partial credit" : "Needs review"}
                        </p>
                      </div>
                    );
                  })}

                  {(Array.isArray(selectedSubmission.answers)
                    ? (selectedSubmission.answers as AnswerEntry[])
                    : []
                  ).length === 0 ? (
                    <p className="text-sm text-zinc-500">No captured answers for this submission.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Select a student to review answers.</p>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
