"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Term = { id: string; name: string };

type QuizQuestion = {
  content: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points: number;
};

type QuizDraft = {
  id: string;
  title: string;
  term_id: string;
  duration: number | null;
  allow_auto_score: boolean;
  allow_review: boolean;
  quiz_password: string | null;
  opens_at: string | null;
  closes_at: string | null;
};

export function CreateQuizClient({
  classId,
  terms,
  mode = "create",
  quiz,
  initialQuestions,
}: {
  classId: string;
  terms: Term[];
  mode?: "create" | "edit";
  quiz?: QuizDraft | null;
  initialQuestions?: QuizQuestion[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const [quizTitle, setQuizTitle] = useState(quiz?.title ?? "");
  const [quizTermId, setQuizTermId] = useState(quiz?.term_id ?? terms[0]?.id ?? "");
  const [duration, setDuration] = useState(quiz?.duration ?? 15);
  const [allowAutoScore, setAllowAutoScore] = useState(quiz?.allow_auto_score ?? true);
  const [allowReview, setAllowReview] = useState(quiz?.allow_review ?? false);
  const [quizPassword, setQuizPassword] = useState(quiz?.quiz_password ?? "");
  const [opensAt, setOpensAt] = useState(quiz?.opens_at ? quiz.opens_at.slice(0, 16) : "");
  const [closesAt, setClosesAt] = useState(quiz?.closes_at ? quiz.closes_at.slice(0, 16) : "");

  const [questionBlocks, setQuestionBlocks] = useState<QuizQuestion[]>(
    initialQuestions && initialQuestions.length > 0
      ? initialQuestions
      : [
          {
            content: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: "",
            points: 1,
          },
        ],
  );

  function addQuestionBlock() {
    setQuestionBlocks((prev) => [
      ...prev,
      {
        content: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "",
        points: 1,
      },
    ]);
  }

  async function createQuiz(event: FormEvent) {
    event.preventDefault();

    const normalizedQuestions = questionBlocks.map((block) => ({
      content: block.content,
      options: [block.optionA, block.optionB, block.optionC, block.optionD],
      correctAnswer: block.correctAnswer,
      points: block.points,
    }));

    if (
      normalizedQuestions.some(
        (question) =>
          !question.content.trim() ||
          question.options.some((option) => !option.trim()) ||
          !question.correctAnswer.trim(),
      )
    ) {
      setMessage("Complete all MCQ fields before creating quiz.");
      return;
    }

    const response = await fetch("/api/quizzes", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: quiz?.id,
        classId,
        termId: quizTermId,
        title: quizTitle,
        duration,
        allowAutoScore,
        allowReview,
        quizPassword,
        opensAt,
        closesAt,
        questions: normalizedQuestions,
      }),
    });

    const payload = (await response.json()) as { error?: string; quizId?: string };
    if (!response.ok) {
      setMessage(payload.error || (mode === "edit" ? "Unable to update test." : "Unable to create test."));
      return;
    }

    router.push(`/classes/${classId}`);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "edit" ? "Edit test" : "Test builder"}
        </h2>
        <Link href={`/classes/${classId}`} className="text-sm font-semibold text-sky-700 hover:underline">
          Back to class
        </Link>
      </div>

      {message ? <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}

      {terms.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            Create a term first before {mode === "edit" ? "editing" : "creating"} a test.
        </p>
      ) : (
        <form onSubmit={createQuiz} className="space-y-3 rounded-xl border border-zinc-200 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              required
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="Test title"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              required
              value={quizTermId}
              onChange={(e) => setQuizTermId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              placeholder="Duration (minutes)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allowAutoScore}
                onChange={(e) => setAllowAutoScore(e.target.checked)}
              />
              Enable auto score visibility
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allowReview}
                onChange={(e) => setAllowReview(e.target.checked)}
              />
              Allow student review after submit
            </label>
            <input
              type="password"
              value={quizPassword}
              onChange={(e) => setQuizPassword(e.target.value)}
              placeholder="Optional test password"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          {questionBlocks.map((block, index) => (
            <div key={index} className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-sm font-semibold text-zinc-700">Question {index + 1}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  required
                  placeholder="Question content"
                  value={block.content}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, content: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  required
                  placeholder="Option A"
                  value={block.optionA}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, optionA: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option B"
                  value={block.optionB}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, optionB: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option C"
                  value={block.optionC}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, optionC: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option D"
                  value={block.optionD}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, optionD: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Correct answer"
                  value={block.correctAnswer}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, correctAnswer: e.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={block.points}
                  onChange={(e) =>
                    setQuestionBlocks((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, points: Number(e.target.value) } : item,
                      ),
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addQuestionBlock}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Add question
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {mode === "edit" ? "Save changes" : "Create test"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
