"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  type: string;
  content: string;
  imageUrl: string;
  options: string[];
  required: boolean;
  optionFeedback: Record<string, string>;
  points: number;
  correctAnswer: string;
};

type SavedAnswer = {
  questionId: string;
  answer: string;
};

function parseCheckboxAnswer(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item)).filter(Boolean)
      : [];
  } catch {
    return [] as string[];
  }
}

function formatAnswerForDisplay(questionType: string, value: string) {
  if (!value) {
    return "No answer";
  }

  if (questionType === "checkbox") {
    const parsed = parseCheckboxAnswer(value);
    return parsed.length > 0 ? parsed.join(", ") : "No answer";
  }

  return value;
}

function formatExpectedAnswer(questionType: string, value: string) {
  if (!value) {
    return "N/A";
  }

  if (questionType === "checkbox") {
    return formatAnswerForDisplay("checkbox", value);
  }

  if (questionType === "identification") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const entries = parsed.map((item) => String(item).trim()).filter(Boolean);
        return entries.length > 0 ? entries.join(" / ") : "N/A";
      }
    } catch {
      // Single answer text.
    }
  }

  return value;
}

function getOptionFeedback(question: Question, value: string) {
  if (!value) {
    return null;
  }

  if (question.type === "checkbox") {
    const selected = parseCheckboxAnswer(value);
    const feedback = selected
      .map((option) => question.optionFeedback[option])
      .filter(Boolean);
    return feedback.length > 0 ? feedback.join(" | ") : null;
  }

  return question.optionFeedback[value] || null;
}

export function QuizClient({
  classId,
  className,
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
  classId: string;
  className?: string;
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isTabVisible, setIsTabVisible] = useState(true);

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
        return isTabVisible ? prev - 1 : prev;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isStudent, completedSubmission, attemptStarted, isTabVisible]);

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
      const isHidden = document.hidden;
      setIsTabVisible(!isHidden);
      if (isHidden) {
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

  // Auto-save on keystroke with debouncing
  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    let debounceTimer: NodeJS.Timeout | undefined;

    async function performAutosave() {
      setSaveStatus("saving");
      const payload = randomizedQuestions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] || "",
      }));

      // persist draft locally first
      try {
        const storageKey = `quiz_${quizId}_draft_answers`;
        const stored = { answers: payload, remainingSeconds: secondsLeft, savedAt: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch {
        // ignore localStorage errors
      }

      try {
        const response = await fetch("/api/quizzes/attempt", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId, answers: payload, remainingSeconds: secondsLeft }),
          keepalive: true,
          credentials: "same-origin",
        });

        if (response.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }

    // Debounce keystroke-based saves (500ms)
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void performAutosave();
    }, 500);

    return () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isStudent, completedSubmission, attemptStarted, answers, randomizedQuestions, quizId, secondsLeft]);

  // Periodic auto-save as fallback (every 10 seconds)
  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    const intervalTimer = setInterval(() => {
      setSaveStatus("saving");
      const payload = randomizedQuestions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] || "",
      }));

      // persist draft locally
      try {
        const storageKey = `quiz_${quizId}_draft_answers`;
        const stored = { answers: payload, remainingSeconds: secondsLeft, savedAt: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch {}

      void fetch("/api/quizzes/attempt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: payload, remainingSeconds: secondsLeft }),
        keepalive: true,
        credentials: "same-origin",
      }).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }).catch(() => {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      });
    }, 10000);

    return () => clearInterval(intervalTimer);
  }, [isStudent, completedSubmission, attemptStarted, randomizedQuestions, answers, secondsLeft, quizId]);

  // Restore draft from localStorage on mount (merge with server-restored answers)
  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) return;

    try {
      const storageKey = `quiz_${quizId}_draft_answers`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { answers?: { questionId: string; answer: string }[]; remainingSeconds?: number };
      if (!parsed || !Array.isArray(parsed.answers)) return;

      // Merge stored answers into current answers state without overwriting server-provided answers unless empty
      setAnswers((prev) => {
        const next = { ...prev };
        for (const entry of parsed.answers || []) {
          if (!next[entry.questionId] || next[entry.questionId].trim() === "") {
            next[entry.questionId] = entry.answer || "";
          }
        }
        return next;
      });

      if (typeof parsed.remainingSeconds === "number") {
        setSecondsLeft((curr) => Math.min(curr, Math.max(0, parsed.remainingSeconds!)));
      }
    } catch {
      // ignore parse errors
    }
  }, [isStudent, completedSubmission, attemptStarted, quizId]);

  // Ensure answers are saved on unload/refresh using sendBeacon or keepalive fetch
  useEffect(() => {
    if (!isStudent || completedSubmission || !attemptStarted) return;

    const sendSave = () => {
      try {
        const payload = randomizedQuestions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] || "",
        }));
        const body = JSON.stringify({ quizId, answers: payload, remainingSeconds: secondsLeft });

        // Always persist draft locally first
        try {
          const storageKey = `quiz_${quizId}_draft_answers`;
          const stored = { answers: payload, remainingSeconds: secondsLeft, savedAt: Date.now() };
          localStorage.setItem(storageKey, JSON.stringify(stored));
        } catch {}

        // Use keepalive fetch with credentials so cookies are sent (sendBeacon doesn't send cookies)
        void fetch("/api/quizzes/attempt", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          credentials: "same-origin",
        }).catch(() => {
          /* ignore errors during unload */
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", sendSave);
    window.addEventListener("pagehide", sendSave);

    return () => {
      window.removeEventListener("beforeunload", sendSave);
      window.removeEventListener("pagehide", sendSave);
    };
  }, [isStudent, completedSubmission, attemptStarted, randomizedQuestions, answers, secondsLeft, quizId]);

  async function submitQuiz(event?: FormEvent) {
    event?.preventDefault();

    if (!isStudent || completedSubmission || !attemptStarted) {
      return;
    }

    const missingRequired = randomizedQuestions.find((question) => {
      if (!question.required) {
        return false;
      }

      const value = answers[question.id] || "";
      if (question.type === "checkbox") {
        return parseCheckboxAnswer(value).length === 0;
      }

      return value.trim().length === 0;
    });

    if (missingRequired) {
      setMessage("Please answer all required questions before submitting.");
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
      <section className="space-y-4">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
              <p className="mt-2 text-sm text-zinc-600">Teacher preview mode.</p>
              <p className="mt-1 text-sm text-zinc-600">Questions: {questions.length}</p>
              <p className="text-sm text-zinc-600">Total score: {totalScore}</p>
              <p className="mt-1 text-sm text-zinc-600">
                Opens: {opensAtDate ? opensAtDate.toLocaleString() : "Anytime"} | Closes: {closesAtDate ? closesAtDate.toLocaleString() : "No close"}
              </p>
            </div>

            <Link
              href={`/classes/${classId}/quizzes/${quizId}/edit`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Edit test
            </Link>
          </div>
        </header>

        <div className="space-y-3">
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {index + 1}. {question.content}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{question.type}</p>
                </div>
                {question.required ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                    Required
                  </span>
                ) : null}
              </div>

              {question.imageUrl ? (
                <img
                  src={question.imageUrl}
                  alt={`Question ${index + 1}`}
                  className="mt-2 max-h-64 w-full rounded-lg border border-zinc-200 object-contain"
                />
              ) : null}

              <p className="mt-2 text-sm text-zinc-700">Points: {question.points}</p>

              {(question.type === "mcq" || question.type === "dropdown" || question.type === "checkbox") && question.options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-${optionIndex}`} className="rounded-lg border border-zinc-200 p-2 text-sm text-zinc-700">
                      {option}
                      {question.optionFeedback && question.optionFeedback[option] ? (
                        <p className="mt-1 text-xs text-sky-700">Feedback: {question.optionFeedback[option]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {(question.type === "identification" || question.type === "essay") ? (
                <p className="mt-3 text-sm text-zinc-700">
                  Answer key: {formatExpectedAnswer(question.type, question.correctAnswer)}
                </p>
              ) : null}

              {(question.type === "mcq" || question.type === "dropdown" || question.type === "checkbox") ? (
                <p className="mt-3 text-sm text-zinc-700">
                  Correct answer: {formatExpectedAnswer(question.type, question.correctAnswer)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
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
          const rawStudentAnswer = reviewAnswers.get(question.id) || "";
          const studentAnswer = formatAnswerForDisplay(question.type, rawStudentAnswer);
          const isCorrect = (() => {
            if (question.type === "essay") {
              return false;
            }

            if (question.type === "checkbox") {
              const expected = parseCheckboxAnswer(question.correctAnswer).sort();
              const actual = parseCheckboxAnswer(rawStudentAnswer).sort();
              if (expected.length === 0 || actual.length === 0 || expected.length !== actual.length) {
                return false;
              }

              return expected.every((value, idx) => value.toLowerCase() === actual[idx].toLowerCase());
            }

            if (question.type === "identification") {
              const normalizedResponse = rawStudentAnswer.trim().toLowerCase();
              if (!normalizedResponse) {
                return false;
              }

              try {
                const parsed = JSON.parse(question.correctAnswer || "[]");
                if (Array.isArray(parsed)) {
                  return parsed
                    .map((item) => String(item).trim().toLowerCase())
                    .filter(Boolean)
                    .includes(normalizedResponse);
                }
              } catch {
                // Fallback to single answer compare.
              }
            }

            return (
              rawStudentAnswer.trim().length > 0 &&
              rawStudentAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
            );
          })();

          const correctAnswerLabel =
            formatExpectedAnswer(question.type, question.correctAnswer);
          const optionFeedback = getOptionFeedback(question, rawStudentAnswer);

          return (
            <article key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">
                {index + 1}. {question.content}
              </p>
              {question.imageUrl ? (
                <img
                  src={question.imageUrl}
                  alt={`Question ${index + 1}`}
                  className="mt-2 max-h-64 w-full rounded-lg border border-zinc-200 object-contain"
                />
              ) : null}
              <p className="mt-2 text-sm text-zinc-700">Your answer: {studentAnswer}</p>
              {optionFeedback ? (
                <p className="text-sm text-sky-700">Feedback: {optionFeedback}</p>
              ) : null}
              <p className="text-sm text-zinc-700">Correct answer: {correctAnswerLabel}</p>
              <p className={`mt-1 text-xs font-semibold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                {question.type === "essay" ? "Manual review" : isCorrect ? "Correct" : "Incorrect"}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
            {className ? (
              <p className="text-sm text-zinc-600">Class: <Link href={`/classes/${classId}`} className="font-semibold text-sky-700 hover:underline">{className}</Link></p>
            ) : null}
          </div>
          <div>
            <Link href={`/classes/${classId}`} className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to class">
              ← Back to class
            </Link>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <span>Duration: {duration} minutes</span>
          <span>Total score: {totalScore}</span>
          <span className="font-semibold text-rose-700">Time left: {minutes}:{seconds}</span>
          <span>Tab switches: {tabSwitchCount}</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            saveStatus === "saving" ? "bg-blue-100 text-blue-700" :
            saveStatus === "saved" ? "bg-emerald-100 text-emerald-700" :
            saveStatus === "error" ? "bg-rose-100 text-rose-700" :
            "text-transparent"
          }`}>
            {saveStatus === "saving" ? "⏳ Saving..." :
             saveStatus === "saved" ? "✓ Saved" :
             saveStatus === "error" ? "✕ Error" : "—"}
          </span>
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
              {question.required ? (
                <p className="mt-1 text-xs font-semibold text-rose-700">Required</p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">Optional</p>
              )}
              {question.imageUrl ? (
                <img
                  src={question.imageUrl}
                  alt={`Question ${index + 1}`}
                  className="mt-2 max-h-64 w-full rounded-lg border border-zinc-200 object-contain"
                />
              ) : null}
              <p className="mt-1 text-xs text-zinc-500">Points: {question.points}</p>

              {(question.type === "mcq" || question.type === "dropdown") && question.options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {question.type === "mcq"
                    ? question.options.map((option, optionIndex) => (
                        <label key={`${question.id}-mcq-${optionIndex}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-2 text-sm">
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                            }
                            className="h-4 w-4 border border-zinc-400 bg-transparent"
                          />
                          <span>{option}</span>
                        </label>
                      ))
                    : (
                        <select
                          value={answers[question.id] || ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select answer</option>
                          {question.options.map((option, optionIndex) => (
                            <option key={`${question.id}-dropdown-${optionIndex}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                </div>
              ) : null}

              {question.type === "checkbox" ? (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = parseCheckboxAnswer(answers[question.id] || "[]");
                    const checked = selected.includes(option);
                    return (
                      <label key={`${question.id}-check-${optionIndex}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const shouldAdd = e.target.checked;
                            const nextSelected = shouldAdd
                              ? [...selected, option]
                              : selected.filter((value) => value !== option);

                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: JSON.stringify(nextSelected),
                            }));
                          }}
                          className="h-4 w-4 rounded border border-zinc-400 bg-transparent"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {question.type === "identification" ? (
                <input
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                  placeholder="Type your answer"
                  className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              ) : null}

              {question.type === "essay" ? (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                  placeholder="Write your essay answer"
                  className="mt-3 min-h-28 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              ) : null}
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
