"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Term = { id: string; name: string };

export type BuilderQuestionType = "mcq" | "checkbox" | "dropdown" | "identification" | "essay";

export type QuizQuestion = {
  content: string;
  type: BuilderQuestionType;
  imageUrl: string;
  options: string[];
  optionFeedbacks: string[];
  correctAnswers: string[];
  required: boolean;
  showOptionFeedback?: boolean;
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

const QUESTION_TYPE_LABELS: Record<BuilderQuestionType, string> = {
  mcq: "Multiple choice",
  checkbox: "Checkboxes",
  dropdown: "Drop down",
  identification: "Identification (short answer)",
  essay: "Essay (manual points)",
};

function makeEmptyQuestion(): QuizQuestion {
  return {
    content: "",
    type: "mcq",
    imageUrl: "",
    options: ["", ""],
    optionFeedbacks: ["", ""],
    correctAnswers: [],
    required: true,
    showOptionFeedback: false,
    points: 1,
  };
}

function normalizeStringArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function isOptionType(type: BuilderQuestionType) {
  return type === "mcq" || type === "checkbox" || type === "dropdown";
}

function reorderItems<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

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
      ? initialQuestions.map((item) => ({ ...item, showOptionFeedback: false }))
      : [makeEmptyQuestion()],
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploadingQuestions, setUploadingQuestions] = useState<Record<number, boolean>>({});

  const normalizedQuestionBlocks = useMemo(() => questionBlocks, [questionBlocks]);

  function updateQuestion(index: number, updater: (question: QuizQuestion) => QuizQuestion) {
    setQuestionBlocks((prev) => prev.map((question, i) => (i === index ? updater(question) : question)));
  }

  function addQuestionBlock() {
    setQuestionBlocks((prev) => [...prev, makeEmptyQuestion()]);
  }

  function removeQuestionBlock(index: number) {
    setQuestionBlocks((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function addOption(index: number) {
    updateQuestion(index, (question) => ({
      ...question,
      options: [...question.options, ""],
      optionFeedbacks: [...question.optionFeedbacks, ""],
    }));
  }

  function removeOption(index: number, optionIndex: number) {
    updateQuestion(index, (question) => {
      if (question.options.length <= 2) {
        return question;
      }

      const removedOption = question.options[optionIndex] || "";

      return {
        ...question,
        options: question.options.filter((_, idx) => idx !== optionIndex),
        optionFeedbacks: question.optionFeedbacks.filter((_, idx) => idx !== optionIndex),
        correctAnswers: question.correctAnswers.filter((value) => value !== removedOption),
      };
    });
  }

  function updateOption(index: number, optionIndex: number, value: string) {
    updateQuestion(index, (question) => {
      const previousValue = question.options[optionIndex] || "";
      const nextOptions = question.options.map((option, idx) => (idx === optionIndex ? value : option));
      const nextFeedbacks = question.optionFeedbacks.map((feedback, idx) => (idx === optionIndex ? feedback : feedback));

      return {
        ...question,
        options: nextOptions,
        optionFeedbacks: nextFeedbacks,
        correctAnswers: question.correctAnswers.map((answer) => (answer === previousValue ? value : answer)),
      };
    });
  }

  function updateOptionFeedback(index: number, optionIndex: number, value: string) {
    updateQuestion(index, (question) => ({
      ...question,
      optionFeedbacks: question.optionFeedbacks.map((feedback, idx) => (idx === optionIndex ? value : feedback)),
    }));
  }

  async function uploadImage(index: number, file: File) {
    const formData = new FormData();
    formData.append("classId", classId);
    formData.append("file", file);

    setUploadingQuestions((prev) => ({ ...prev, [index]: true }));
    const response = await fetch("/api/quizzes/upload-image", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string; url?: string };
    setUploadingQuestions((prev) => ({ ...prev, [index]: false }));

    if (!response.ok || !payload.url) {
      setMessage(payload.error || "Unable to upload image.");
      return;
    }

    updateQuestion(index, (question) => ({ ...question, imageUrl: payload.url! }));
    setMessage("Image uploaded.");
  }

  async function createQuiz(event: FormEvent) {
    event.preventDefault();

    const normalizedQuestions = normalizedQuestionBlocks.map((question) => {
      const options = isOptionType(question.type) ? normalizeStringArray(question.options) : [];

      const optionBasedAnswerKeys = question.correctAnswers
        .map((value) => value.trim())
        .filter(Boolean);

      const optionFeedback = options.reduce<Record<string, string>>((map, option, idx) => {
        const feedback = String(question.optionFeedbacks[idx] || "").trim();
        if (feedback) {
          map[option] = feedback;
        }
        return map;
      }, {});

      return {
        content: String(question.content || "").trim(),
        type: question.type,
        imageUrl: String(question.imageUrl || "").trim(),
        options,
        optionFeedback,
        correctAnswer: optionBasedAnswerKeys[0] || "",
        correctAnswers: optionBasedAnswerKeys,
        required: Boolean(question.required),
        points: Math.max(1, Number(question.points || 1)),
      };
    });

    for (const question of normalizedQuestions) {
      if (!question.content && !question.imageUrl) {
        setMessage("Each question needs text or an image.");
        return;
      }

      if ((question.type === "mcq" || question.type === "dropdown") && question.options.length < 2) {
        setMessage("Multiple choice and drop down questions need at least two options.");
        return;
      }

      if (question.type === "mcq" || question.type === "dropdown" || question.type === "checkbox") {
        const seen = new Set<string>();
        const hasDuplicate = question.options.some((option) => {
          const key = option.toLowerCase();
          if (seen.has(key)) {
            return true;
          }
          seen.add(key);
          return false;
        });

        if (hasDuplicate) {
          setMessage("Options must be unique per question.");
          return;
        }
      }

      if (
        (question.type === "mcq" || question.type === "dropdown") &&
        (question.correctAnswers.length === 0 || question.correctAnswers.some((value) => !question.options.includes(value)))
      ) {
        setMessage("Answer keys must be selected from the added options.");
        return;
      }

      if (question.type === "checkbox") {
        if (question.options.length < 2) {
          setMessage("Checkbox questions need at least two options.");
          return;
        }

        if (
          question.correctAnswers.length === 0 ||
          question.correctAnswers.some((value) => !question.options.includes(value))
        ) {
          setMessage("Select checkbox answer key from the added options.");
          return;
        }
      }

      if (question.type === "identification" && question.correctAnswers.length === 0) {
        setMessage("Identification questions require at least one answer key.");
        return;
      }
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

    const payload = (await response.json()) as { error?: string };
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
        <h2 className="text-lg font-semibold text-zinc-900">{mode === "edit" ? "Edit test" : "Test builder"}</h2>
        <Link href={`/classes/${classId}`} className="text-sm font-semibold text-sky-700 hover:underline">
          Back to class
        </Link>
      </div>

      {message ? <p className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

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
              onChange={(e) => setDuration(Number(e.target.value) || 1)}
              placeholder="Duration (minutes)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              <input type="checkbox" checked={allowAutoScore} onChange={(e) => setAllowAutoScore(e.target.checked)} />
              Enable auto score visibility
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              <input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} />
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

          {normalizedQuestionBlocks.map((block, index) => {
            const isOptionQuestion = isOptionType(block.type);
            const normalizedOptions = normalizeStringArray(block.options);

            return (
              <div
                key={index}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === index) {
                    setDragIndex(null);
                    return;
                  }

                  setQuestionBlocks((prev) => reorderItems(prev, dragIndex, index));
                  setDragIndex(null);
                }}
                className="rounded-lg border border-zinc-200 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-700">Question {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600">Drag to reorder</span>
                    <button
                      type="button"
                      onClick={() => removeQuestionBlock(index)}
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Remove question
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <textarea
                    value={block.content}
                    onChange={(e) => updateQuestion(index, (item) => ({ ...item, content: e.target.value }))}
                    placeholder="Question content"
                    className="min-h-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                  />

                  <select
                    value={block.type}
                    onChange={(e) => {
                      const nextType = e.target.value as BuilderQuestionType;
                      updateQuestion(index, (item) => ({
                        ...item,
                        type: nextType,
                        options: isOptionType(nextType) ? (item.options.length >= 2 ? item.options : ["", ""]) : [],
                        optionFeedbacks: isOptionType(nextType) ? (item.optionFeedbacks.length >= 2 ? item.optionFeedbacks : ["", ""]) : [],
                        correctAnswers:
                          nextType === "checkbox" || nextType === "mcq" || nextType === "dropdown" || nextType === "identification"
                            ? item.correctAnswers
                            : [],
                      }));
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {(Object.keys(QUESTION_TYPE_LABELS) as BuilderQuestionType[]).map((type) => (
                      <option key={type} value={type}>
                        {QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={block.points}
                    onChange={(e) =>
                      updateQuestion(index, (item) => ({ ...item, points: Number(e.target.value) || 1 }))
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />

                  <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={block.required}
                      onChange={(e) => updateQuestion(index, (item) => ({ ...item, required: e.target.checked }))}
                      className="h-4 w-4 rounded border border-zinc-400 bg-transparent"
                    />
                    Required question
                  </label>

                  <div className="sm:col-span-2 rounded-lg border border-zinc-300 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                        {uploadingQuestions[index] ? "Uploading..." : "Upload image"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                          className="hidden"
                          disabled={Boolean(uploadingQuestions[index])}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void uploadImage(index, file);
                            }
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {block.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, (item) => ({ ...item, imageUrl: "" }))}
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    {block.imageUrl ? (
                      <img
                        src={block.imageUrl}
                        alt={`Question ${index + 1}`}
                        className="mt-3 max-h-72 w-full rounded-lg border border-zinc-200 object-contain"
                      />
                    ) : null}
                  </div>

                  {isOptionQuestion ? (
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-500">Options</p>
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, (item) => ({ ...item, showOptionFeedback: !item.showOptionFeedback }))}
                          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          {block.showOptionFeedback ? "Hide feedback" : "Add option feedback"}
                        </button>
                      </div>
                      {block.options.map((option, optionIndex) => (
                        <div key={`${index}-${optionIndex}`} className="grid gap-2 rounded-lg border border-zinc-200 p-2">
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              value={option}
                              onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                              placeholder={`Option ${optionIndex + 1}`}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(index, optionIndex)}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              Remove
                            </button>
                          </div>
                          {block.showOptionFeedback ? (
                            <input
                              value={block.optionFeedbacks[optionIndex] || ""}
                              onChange={(e) => updateOptionFeedback(index, optionIndex, e.target.value)}
                              placeholder="Feedback for this option (optional)"
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                            />
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(index)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                      >
                        Add option
                      </button>
                    </div>
                  ) : null}

                  {(block.type === "mcq" || block.type === "dropdown") ? (
                    <div className="space-y-2 sm:col-span-2">
                      <p className="text-xs font-semibold text-zinc-500">Answer key</p>
                      {normalizedOptions.length === 0 ? (
                        <p className="text-xs text-zinc-500">Add options first.</p>
                      ) : (
                        block.options.map((option, optionIndex) => {
                          const normalizedOption = option.trim();
                          if (!normalizedOption) {
                            return null;
                          }

                          const checked = block.correctAnswers.includes(normalizedOption);
                          return (
                          <label key={`${index}-answer-${optionIndex}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              value={normalizedOption}
                              checked={checked}
                              onChange={(e) =>
                                updateQuestion(index, (item) => ({
                                  ...item,
                                  correctAnswers: e.target.checked
                                    ? [...item.correctAnswers, normalizedOption]
                                    : item.correctAnswers.filter((value) => value !== normalizedOption),
                                }))
                              }
                              className="h-4 w-4 rounded border border-zinc-400 bg-transparent"
                            />
                            <span>{normalizedOption}</span>
                          </label>
                          );
                        })
                      )}
                    </div>
                  ) : null}

                  {block.type === "checkbox" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <p className="text-xs font-semibold text-zinc-500">Answer key (select all correct options)</p>
                      {normalizedOptions.length === 0 ? (
                        <p className="text-xs text-zinc-500">Add options first.</p>
                      ) : (
                        block.options.map((option, optionIndex) => {
                          const normalizedOption = option.trim();
                          if (!normalizedOption) {
                            return null;
                          }

                          const checked = block.correctAnswers.includes(normalizedOption);
                          return (
                            <label key={`${index}-check-${optionIndex}`} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const shouldAdd = e.target.checked;
                                  updateQuestion(index, (item) => ({
                                    ...item,
                                    correctAnswers: shouldAdd
                                      ? [...item.correctAnswers, normalizedOption]
                                      : item.correctAnswers.filter((value) => value !== normalizedOption),
                                  }));
                                }}
                                className="h-4 w-4 rounded border border-zinc-400 bg-transparent"
                              />
                              <span>{normalizedOption}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : null}

                  {block.type === "identification" ? (
                    <textarea
                      value={block.correctAnswers.join("\n")}
                      onChange={(e) => {
                        const entries = e.target.value
                          .split(/\r?\n|,/)
                          .map((value) => value.trim())
                          .filter(Boolean);
                        updateQuestion(index, (item) => ({
                          ...item,
                          correctAnswers: entries,
                        }));
                      }}
                      placeholder="Answer keys (one per line, or comma-separated)"
                      className="min-h-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                    />
                  ) : null}

                  {block.type === "essay" ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 sm:col-span-2">
                      Essay answers are manually checked. Points are still included in total score.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

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
