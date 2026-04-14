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
};

export function QuizReviewClient({ quizId }: { quizId: string }) {
  const [quizTitle, setQuizTitle] = useState("Test");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  async function saveScore(submissionId: string, score: number, status: string) {
    const response = await fetch("/api/quizzes/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, score, status }),
    });

    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessage(data.error || "Unable to update score.");
      return;
    }

    setMessage(data.message || "Score updated.");
    void loadData();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">{quizTitle}</h2>
        <Link href={`/quizzes/${quizId}`} className="text-sm font-semibold text-sky-700 hover:underline">
          Back to test
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
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const score = Number(formData.get("score") ?? 0);
                      const status = String(formData.get("status") ?? "graded");
                      void saveScore(selectedSubmission.id, score, status);
                    }}
                  >
                    <input
                      name="score"
                      type="number"
                      min={0}
                      defaultValue={selectedSubmission.score}
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
                </div>

                <div className="mt-3 space-y-2">
                  {(Array.isArray(selectedSubmission.answers)
                    ? (selectedSubmission.answers as AnswerEntry[])
                    : []
                  ).map((entry, index) => {
                    const question = questionMap.get(entry.questionId);
                    const expected = (question?.correct_answer || "").trim();
                    const actual = (entry.answer || "").trim();
                    const isCorrect =
                      expected.length > 0 &&
                      actual.length > 0 &&
                      actual.toLowerCase() === expected.toLowerCase();

                    return (
                      <div
                        key={`${selectedSubmission.id}-${entry.questionId}-${index}`}
                        className="rounded-lg border border-zinc-200 p-3 text-sm"
                      >
                        <p className="font-semibold text-zinc-900">{question?.content || "Question removed"}</p>
                        <p className="mt-1 text-zinc-700">Student answer: {actual || "No answer"}</p>
                        <p className="text-zinc-700">Correct answer: {expected || "N/A"}</p>
                        <p className={`text-xs font-semibold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCorrect ? "Correct" : "Needs review"}
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
