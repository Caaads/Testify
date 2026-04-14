"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  content: string;
  options: string[];
  points: number;
  correctAnswer: string;
};

type SavedAnswer = {
  questionId: string;
  answer: string;
};

export function QuizClient({
  quizId,
  title,
  duration,
  totalScore,
  isStudent,
  allowReview,
  opensAt,
  closesAt,
  hasPassword,
  existingSubmission,
  questions,
}: {
  quizId: string;
  title: string;
  duration: number;
  totalScore: number;
  isStudent: boolean;
  allowReview: boolean;
  opensAt: string | null;
  closesAt: string | null;
  hasPassword: boolean;
  existingSubmission: {
    id: string;
    score: number;
    status: string;
    submitted_at: string;
    answers?: unknown;
    remaining_seconds?: number | null;
  } | null;
  questions: Question[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(1, Number(existingSubmission?.remaining_seconds ?? duration * 60)),
  );
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [attemptStarted, setAttemptStarted] = useState(existingSubmission?.status === "in_progress");
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);

  const randomizedQuestions = useMemo(() => {
    const copy = [...questions];
    copy.sort(() => Math.random() - 0.5);
    return copy.map((question) => ({
      ...question,
      options: [...question.options].sort(() => Math.random() - 0.5),
    }));
  }, [questions]);

  const completedSubmission =
    existingSubmission && existingSubmission.status !== "in_progress"
      ? existingSubmission
      : null;

  const hasReviewAccess = Boolean(completedSubmission && allowReview);

  const reviewAnswers = useMemo(() => {
    if (!completedSubmission || !Array.isArray(completedSubmission.answers)) {
      return new Map<string, string>();
    }

    const entries = completedSubmission.answers as SavedAnswer[];
    return new Map(entries.map((entry) => [entry.questionId, entry.answer]));
  }, [completedSubmission]);

  async function startAttempt(overridePassword?: string) {
    const response = await fetch("/api/quizzes/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, password: overridePassword ?? password }),
    });

    const data = (await response.json()) as {
      error?: string;
      requiresPassword?: boolean;
      remainingSeconds?: number;
      answers?: SavedAnswer[];
      alreadySubmitted?: boolean;
    };

    if (!response.ok) {
      setRequiresPassword(Boolean(data.requiresPassword));
      setMessage(data.error || "Unable to start test attempt.");
      return false;
    }

    if (data.alreadySubmitted) {
      router.refresh();
      return false;
    }

    setAttemptStarted(true);
    setRequiresPassword(false);
    setMessage(null);
    if (typeof data.remainingSeconds === "number") {
      setSecondsLeft(Math.max(0, data.remainingSeconds));
    }

    if (Array.isArray(data.answers)) {
      const restored = Object.fromEntries(
        data.answers.map((entry) => [entry.questionId, entry.answer]),
      );
      setAnswers(restored);
    }

    return true;
  }

  useEffect(() => {
    if (!isStudent || completedSubmission || attemptStarted) {
      return;
    }

    void startAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, completedSubmission, attemptStarted]);

  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isStudent, completedSubmission, attemptStarted]);

  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    function disableContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function disableCopyPaste(event: ClipboardEvent) {
      event.preventDefault();
      setMessage("Copy and paste are disabled during test.");
    }

    function trackTabSwitch() {
      if (document.hidden) {
        setTabSwitchCount((count) => count + 1);
      }
    }

    document.addEventListener("contextmenu", disableContextMenu);
    document.addEventListener("copy", disableCopyPaste);
    document.addEventListener("paste", disableCopyPaste);
    document.addEventListener("visibilitychange", trackTabSwitch);

    return () => {
      document.removeEventListener("contextmenu", disableContextMenu);
      document.removeEventListener("copy", disableCopyPaste);
      document.removeEventListener("paste", disableCopyPaste);
      document.removeEventListener("visibilitychange", trackTabSwitch);
    };
  }, [isStudent, completedSubmission, attemptStarted]);

  useEffect(() => {
    if (secondsLeft === 0 && isStudent && !completedSubmission && attemptStarted) {
      void submitQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    const autosave = window.setInterval(() => {
      const payload = randomizedQuestions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] || "",
      }));

      void fetch("/api/quizzes/attempt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: payload, remainingSeconds: secondsLeft }),
      });
    }, 10000);

    return () => window.clearInterval(autosave);
  }, [isStudent, completedSubmission, attemptStarted, randomizedQuestions, answers, secondsLeft, quizId]);

  async function submitQuiz(event?: FormEvent) {
    event?.preventDefault();

    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    const payload = randomizedQuestions.map((question) => ({
      questionId: question.id,
      answer: answers[question.id] || "",
    }));

    const response = await fetch("/api/quizzes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId,
        answers: payload,
        password,
        remainingSeconds: secondsLeft,
      }),
    });

    const data = (await response.json()) as { error?: string; score?: number | null };

    if (!response.ok) {
      setMessage(data.error || "Failed to submit test.");
      return;
    }

    if (typeof data.score === "number") {
      setMessage(`Test submitted. Your score: ${data.score}`);
    } else {
      setMessage("Test submitted for manual review.");
    }

    router.refresh();
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  const now = new Date();
  const opensAtDate = opensAt ? new Date(opensAt) : null;
  const closesAtDate = closesAt ? new Date(closesAt) : null;

  const startsInFuture = opensAtDate && now < opensAtDate;
  const closedToNewAttempts = closesAtDate && now > closesAtDate && !attemptStarted;

  if (!isStudent) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">Teacher preview mode.</p>
        <p className="mt-2 text-sm text-zinc-600">Questions: {questions.length}</p>
        <p className="text-sm text-zinc-600">Total score: {totalScore}</p>
        <p className="mt-1 text-sm text-zinc-600">
          Opens: {opensAtDate ? opensAtDate.toLocaleString() : "Anytime"} | Closes: {closesAtDate ? closesAtDate.toLocaleString() : "No close"}
        </p>
      </section>
    );
  }

  if (completedSubmission && !hasReviewAccess) {
    return (
      <section className="space-y-4">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Submitted on {new Date(completedSubmission.submitted_at).toLocaleString()}
          </p>
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Score: {completedSubmission.score}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Review is currently disabled by your teacher.
          </p>
        </header>
      </section>
    );
  }

  if (completedSubmission && hasReviewAccess) {
    return (
      <section className="space-y-4">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Submitted on {new Date(completedSubmission.submitted_at).toLocaleString()}
          </p>
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Score: {completedSubmission.score}
          </p>
        </header>

        {questions.map((question, index) => {
          const studentAnswer = reviewAnswers.get(question.id) || "No answer";
          const isCorrect =
            studentAnswer !== "No answer" &&
            studentAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

          return (
            <article key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">
                {index + 1}. {question.content}
              </p>
              <p className="mt-2 text-sm text-zinc-700">Your answer: {studentAnswer}</p>
              <p className="text-sm text-zinc-700">Correct answer: {question.correctAnswer || "N/A"}</p>
              <p className={`mt-1 text-xs font-semibold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                {isCorrect ? "Correct" : "Incorrect"}
              </p>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-600">
          <span>Duration: {duration} minutes</span>
          <span>Total score: {totalScore}</span>
          <span className="font-semibold text-rose-700">Time left: {minutes}:{seconds}</span>
          <span>Tab switches: {tabSwitchCount}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Opens: {opensAtDate ? opensAtDate.toLocaleString() : "Anytime"} | Closes: {closesAtDate ? closesAtDate.toLocaleString() : "No close"}
        </p>
        {hasPassword ? <p className="text-sm text-zinc-600">This test requires a password to start.</p> : null}
      </header>

      {message ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      {!attemptStarted && startsInFuture ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Test opens at {opensAtDate?.toLocaleString()}.
        </p>
      ) : null}

      {!attemptStarted && closedToNewAttempts ? (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          Test is closed. Late submissions are not accepted.
        </p>
      ) : null}

      {!attemptStarted && requiresPassword && !closedToNewAttempts && !startsInFuture ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void startAttempt(password);
          }}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <label className="mb-2 block text-sm font-medium text-zinc-700">Test password</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Unlock test
            </button>
          </div>
        </form>
      ) : null}

      {attemptStarted ? (
        <form onSubmit={submitQuiz} className="space-y-3">
          {randomizedQuestions.map((question, index) => (
            <article key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">
                {index + 1}. {question.content}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Points: {question.points}</p>

              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-2 text-sm">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </article>
          ))}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Submit test
          </button>
        </form>
      ) : null}
    </section>
  );
}
