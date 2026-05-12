"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toDatetimeLocalValue } from "@/lib/date-utils";

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

type GeneratedQuestion = {
  type: BuilderQuestionType;
  content: string;
  imageUrl?: string;
  options: string[];
  optionFeedbacks?: string[];
  correctAnswers: string[];
  required?: boolean;
  points?: number;
};

type QuestionBreakdown = {
  mcq: number;
  checkbox: number;
  dropdown: number;
  identification: number;
  essay: number;
};

type GenerateMaterialsResponse = {
  error?: string;
  details?: string;
  questions?: GeneratedQuestion[];
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

function GripDots() {
  return (
    <svg viewBox="0 0 16 24" className="h-6 w-4 text-zinc-400" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="12" cy="10" r="1.5" />
      <circle cx="4" cy="16" r="1.5" />
      <circle cx="12" cy="16" r="1.5" />
    </svg>
  );
}

export function CreateQuizClient({
  classId,
  terms,
  mode = "create",
  showAiBuilder = false,
  quiz,
  initialQuestions,
}: {
  classId: string;
  terms: Term[];
  mode?: "create" | "edit";
  showAiBuilder?: boolean;
  quiz?: QuizDraft | null;
  initialQuestions?: QuizQuestion[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const [quizTitle, setQuizTitle] = useState(quiz?.title ?? "");
  const [quizTermId, setQuizTermId] = useState(quiz?.term_id ?? terms[0]?.id ?? "");
  
  // Convert duration (minutes) to hours, minutes, seconds
  const initialDurationMinutes = quiz?.duration ?? 15;
  const initialHours = Math.floor(initialDurationMinutes / 60);
  const initialMinutes = initialDurationMinutes % 60;
  const [durationHours, setDurationHours] = useState(initialHours);
  const [durationMinutes, setDurationMinutes] = useState(initialMinutes);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const duration = durationHours * 60 + durationMinutes + (durationSeconds > 0 ? 1 : 0);
  
  const [allowAutoScore, setAllowAutoScore] = useState(quiz?.allow_auto_score ?? true);
  const [allowReview, setAllowReview] = useState(quiz?.allow_review ?? false);
  const [quizPassword, setQuizPassword] = useState(quiz?.quiz_password ?? "");
  const [showQuizPassword, setShowQuizPassword] = useState(false);
  const [opensAt, setOpensAt] = useState(quiz?.opens_at ? toDatetimeLocalValue(quiz.opens_at) : "");
  const [closesAt, setClosesAt] = useState(quiz?.closes_at ? toDatetimeLocalValue(quiz.closes_at) : "");
  const [referenceMaterialFile, setReferenceMaterialFile] = useState<File | null>(null);
  const [referenceMaterialTotal, setReferenceMaterialTotal] = useState(6);
  const [referenceMaterialBreakdown, setReferenceMaterialBreakdown] = useState<QuestionBreakdown>({
    mcq: 3,
    checkbox: 1,
    dropdown: 0,
    identification: 1,
    essay: 1,
  });
  const [referenceMaterialMessage, setReferenceMaterialMessage] = useState<string | null>(null);
  const [referenceMaterialGenerating, setReferenceMaterialGenerating] = useState(false);
  const [previewGeneratedQuestions, setPreviewGeneratedQuestions] = useState<QuizQuestion[]>([]);

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

  function isBlankQuestion(question: QuizQuestion) {
    return (
      !question.content.trim() &&
      !question.imageUrl.trim() &&
      question.options.every((option) => !option.trim()) &&
      question.correctAnswers.length === 0
    );
  }

  function updateBreakdown(type: keyof QuestionBreakdown, value: number) {
    setReferenceMaterialBreakdown((prev) => ({
      ...prev,
      [type]: Math.max(0, value),
    }));
  }

  function mapGeneratedQuestions(questions: GeneratedQuestion[]) {
    return questions.map((question) => ({
      content: question.content || "",
      type: question.type,
      imageUrl: question.imageUrl || "",
      options: Array.isArray(question.options) ? question.options : [],
      optionFeedbacks: Array.isArray(question.optionFeedbacks)
        ? question.optionFeedbacks
        : Array.isArray(question.options)
          ? question.options.map(() => "")
          : [],
      correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers : [],
      required: Boolean(question.required ?? true),
      showOptionFeedback: false,
      points: Math.max(1, Number(question.points || 1)),
    }));
  }

  function insertGeneratedQuestions(questions: QuizQuestion[]) {
    setQuestionBlocks((prev) => (prev.length === 1 && isBlankQuestion(prev[0]) ? questions : [...prev, ...questions]));
  }

  async function generateQuestionsFromReferenceMaterial() {
    setReferenceMaterialMessage(null);

    if (!referenceMaterialFile) {
      setReferenceMaterialMessage("Choose a reference file first.");
      return;
    }

    const totalRequested = Math.max(1, Number(referenceMaterialTotal || 0));
    const breakdownTotal = Object.values(referenceMaterialBreakdown).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);

    if (breakdownTotal !== totalRequested) {
      setReferenceMaterialMessage("The question type counts must add up to the total number of items.");
      return;
    }

    const formData = new FormData();
    formData.append("classId", classId);
    formData.append("file", referenceMaterialFile);
    formData.append("totalQuestions", String(totalRequested));
    formData.append("mcqCount", String(referenceMaterialBreakdown.mcq));
    formData.append("checkboxCount", String(referenceMaterialBreakdown.checkbox));
    formData.append("dropdownCount", String(referenceMaterialBreakdown.dropdown));
    formData.append("identificationCount", String(referenceMaterialBreakdown.identification));
    formData.append("essayCount", String(referenceMaterialBreakdown.essay));

    try {
      setReferenceMaterialGenerating(true);
      const response = await fetch("/api/quizzes/generate-from-materials", {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();
      let payload: GenerateMaterialsResponse = {};

      if (rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as GenerateMaterialsResponse;
        } catch {
          payload = {
            error: "AI generation returned a non-JSON response.",
            details: rawText.slice(0, 400),
          };
        }
      }

      if (!response.ok || !payload.questions || payload.questions.length === 0) {
        const details = payload.details ? ` Details: ${payload.details}` : "";
        setReferenceMaterialMessage((payload.error || "Unable to generate questions from the reference file.") + details);
        return;
      }

      const generatedQuestions = mapGeneratedQuestions(payload.questions);
      setPreviewGeneratedQuestions(generatedQuestions);
      setReferenceMaterialMessage(`Preview ready: ${generatedQuestions.length} generated questions. Review then insert.`);
    } catch (error) {
      setReferenceMaterialMessage(
        error instanceof Error
          ? `Generation failed. Details: ${error.message}`
          : "Generation failed due to an unknown error.",
      );
    } finally {
      setReferenceMaterialGenerating(false);
    }
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
    <section className="rounded-[1.75rem] border border-sky-100 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-blue-900/40 bg-blue-950/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href={`/classes/${classId}`} className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to class">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{mode === "edit" ? "Edit Test" : "Create New Test"}</h2>
            <p className="text-sm text-slate-500">Build your test with a clean, guided layout.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/classes/${classId}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-slate-50">
            Back to Class
          </Link>
          <button
            type="submit"
            form="quiz-builder-form"
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            Publish Test
          </button>
        </div>
      </div>

      {message ? <p className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{message}</p> : null}

      {terms.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Create a term first before {mode === "edit" ? "editing" : "creating"} a test.
        </p>
      ) : (
        <form id="quiz-builder-form" onSubmit={createQuiz} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Test Identity</p>
              <input
                required
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Enter test title e.g. Advanced Calculus Midterm 2"
                className="mt-3 w-full border-0 border-b-2 border-sky-200 bg-transparent px-0 py-2 text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-300 focus:border-sky-500"
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">Academic Term</label>
                  <select
                    required
                    value={quizTermId}
                    onChange={(e) => setQuizTermId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:bg-black"
                  >
                    <option value="">Select term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#08183d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Reference Materials</p>
                  <p className="mt-1 text-sm text-white/65">Upload a file, let AI draft questions, then fine-tune them below.</p>
                </div>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">AI Drafting</span>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-white/10 bg-[#0b1f56] p-4 shadow-sm">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    Source File
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-sky-400/20 bg-white/5 px-4 py-8 text-center transition hover:border-sky-300/40 hover:bg-white/10">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-200" fill="none" aria-hidden="true">
                      <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16.5V20h16v-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="mt-3 text-sm font-semibold text-white">Choose a PDF, DOCX, TXT, or MD file</span>
                    <span className="mt-1 text-xs text-white/55">
                      AI will read this file and build an editable test draft.
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setReferenceMaterialFile(file);
                        setReferenceMaterialMessage(null);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-[#09183b] px-4 py-3 text-sm text-white/80">
                    {referenceMaterialFile ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{referenceMaterialFile.name}</p>
                          <p className="text-xs text-white/55">{Math.ceil(referenceMaterialFile.size / 1024)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReferenceMaterialFile(null)}
                          className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/5"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <p className="text-white/55">No file selected yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0b1f56] p-4 shadow-sm">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    Question Plan
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-white/60">How many items?</label>
                      <input
                        type="number"
                        min={1}
                        value={referenceMaterialTotal}
                        onChange={(e) => setReferenceMaterialTotal(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-2xl border border-white/10 bg-[#09183b] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-cyan-300"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {(Object.entries(referenceMaterialBreakdown) as [keyof QuestionBreakdown, number][]).map(([type, value]) => (
                        <div key={type}>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
                            {QUESTION_TYPE_LABELS[type]}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => updateBreakdown(type, Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-2xl border border-white/10 bg-[#09183b] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-cyan-300"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
                      The type counts must match the total items before AI generation starts.
                    </div>

                    <button
                      type="button"
                      onClick={() => void generateQuestionsFromReferenceMaterial()}
                      disabled={referenceMaterialGenerating}
                      className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {referenceMaterialGenerating ? "Generating questions..." : "Generate questions with AI"}
                    </button>
                  </div>
                </div>
              </div>

              {referenceMaterialMessage ? (
                <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-950/55 p-3 text-sm text-cyan-100">
                  {referenceMaterialMessage}
                </p>
              ) : null}

              {previewGeneratedQuestions.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1f56] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">Preview Before Insert</h4>
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      {previewGeneratedQuestions.length} questions
                    </span>
                  </div>

                  <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
                    {previewGeneratedQuestions.map((question, index) => (
                      <div key={`preview-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                          {index + 1}. {QUESTION_TYPE_LABELS[question.type]}
                        </p>
                        <p className="mt-1 text-sm text-white/90">{question.content}</p>
                        {question.options.length > 0 ? (
                          <p className="mt-1 text-xs text-white/65">
                            Options: {question.options.join(" | ")}
                          </p>
                        ) : null}
                        {question.correctAnswers.length > 0 ? (
                          <p className="mt-1 text-xs text-emerald-200">
                            Answers: {question.correctAnswers.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-white/55">Answers: Manual checking</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        insertGeneratedQuestions(previewGeneratedQuestions);
                        setReferenceMaterialMessage(`Inserted ${previewGeneratedQuestions.length} generated questions into the builder.`);
                        setPreviewGeneratedQuestions([]);
                      }}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Insert into Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewGeneratedQuestions([]);
                        setReferenceMaterialMessage("Preview cleared. Generate again or adjust settings.");
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                    >
                      Discard Preview
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Questions</p>
                  <p className="mt-1 text-sm text-slate-500">Arrange and craft the test items below.</p>
                </div>
                <button
                  type="button"
                  onClick={addQuestionBlock}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  + Add New Question
                </button>
              </div>

              <div className="space-y-4">
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
                      className="rounded-[1.4rem] border p-4 shadow-sm transition hover:border-sky-900 hover:bg-sky-700"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="cursor-grab rounded-full border border-transparent p-1 active:cursor-grabbing"
                            aria-label={`Drag question ${index + 1} to reorder`}
                          >
                            <GripDots />
                          </button>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Multiple Choice</p>
                            <p className="text-xs text-slate-500">Question {index + 1}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">Points</span>
                          <input
                            type="number"
                            min={1}
                            value={block.points}
                            onChange={(e) =>
                              updateQuestion(index, (item) => ({ ...item, points: Number(e.target.value) || 1 }))
                            }
                            className="w-20 rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeQuestionBlock(index)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-rose-200 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2 rounded-2xl border border-slate-900 bg-slate-900 p-3 shadow-sm">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Question Content</label>
                          <textarea
                            value={block.content}
                            onChange={(e) => updateQuestion(index, (item) => ({ ...item, content: e.target.value }))}
                            placeholder="Type your question here..."
                            className="min-h-28 w-full rounded-2xl border border-slate-100 bg-slate-900 px-4 py-3 text-sm text-slate-800 outline-none"
                          />
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Question Type</label>
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
                            className="w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-400 "
                          >
                            {(Object.keys(QUESTION_TYPE_LABELS) as BuilderQuestionType[]).map((type) => (
                              <option key={type} value={type}>
                                {QUESTION_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Question Image</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
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
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          {block.imageUrl ? (
                            <img
                              src={block.imageUrl}
                              alt={`Question ${index + 1}`}
                              className="mt-3 max-h-72 w-full rounded-2xl border border-slate-100 object-contain"
                            />
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Settings</label>
                          <div className="space-y-2">
                            <label className="flex items-center justify-between rounded-2xl bg-slate-300 px-4 py-3 text-sm text-slate-700">
                              <span>Required</span>
                              <input
                                type="checkbox"
                                checked={block.required}
                                onChange={(e) => updateQuestion(index, (item) => ({ ...item, required: e.target.checked }))}
                                className="h-4 w-4 rounded border border-slate-300 bg-transparent text-sky-600"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => updateQuestion(index, (item) => ({ ...item, showOptionFeedback: !item.showOptionFeedback }))}
                              className="w-full rounded-2xl border border-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              {block.showOptionFeedback ? "Hide option feedback" : "Show option feedback"}
                            </button>
                          </div>
                        </div>

                        {isOptionQuestion ? (
                          <div className="space-y-3 sm:col-span-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Choices & Answer Key</p>
                              <button
                                type="button"
                                onClick={() => addOption(index)}
                                className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                              >
                                + Add Option
                              </button>
                            </div>
                            {block.options.map((option, optionIndex) => (
                              <div key={`${index}-${optionIndex}`} className="grid gap-2 rounded-2xl bg-slate-900 p-3 shadow-sm">
                                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                  <input
                                    value={option}
                                    onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                    placeholder={`Option ${optionIndex + 1}`}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeOption(index, optionIndex)}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-rose-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                                {block.showOptionFeedback ? (
                                  <input
                                    value={block.optionFeedbacks[optionIndex] || ""}
                                    onChange={(e) => updateOptionFeedback(index, optionIndex, e.target.value)}
                                    placeholder="Option feedback (optional)"
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-400"
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {(block.type === "mcq" || block.type === "dropdown") ? (
                          <div className="space-y-2 sm:col-span-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Answer Key</p>
                            {normalizedOptions.length === 0 ? (
                              <p className="text-xs text-slate-500">Add options first.</p>
                            ) : (
                              block.options.map((option, optionIndex) => {
                                const normalizedOption = option.trim();
                                if (!normalizedOption) {
                                  return null;
                                }

                                const checked = block.correctAnswers.includes(normalizedOption);
                                return (
                                  <label key={`${index}-answer-${optionIndex}`} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                                      className="h-4 w-4 rounded border border-slate-300 bg-transparent text-sky-600"
                                    />
                                    <span>{normalizedOption}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        ) : null}

                        {block.type === "checkbox" ? (
                          <div className="space-y-2 sm:col-span-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Answer Key (select all correct options)</p>
                            {normalizedOptions.length === 0 ? (
                              <p className="text-xs text-slate-500">Add options first.</p>
                            ) : (
                              block.options.map((option, optionIndex) => {
                                const normalizedOption = option.trim();
                                if (!normalizedOption) {
                                  return null;
                                }

                                const checked = block.correctAnswers.includes(normalizedOption);
                                return (
                                  <label key={`${index}-check-${optionIndex}`} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                                      className="h-4 w-4 rounded border border-slate-300 bg-transparent text-sky-600"
                                    />
                                    <span>{normalizedOption}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        ) : null}

                        {block.type === "identification" ? (
                          <div className="sm:col-span-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Answer Key</label>
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
                              className="min-h-24 w-full rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-400 bg-slate-900 "
                            />
                            <p className="mt-2 text-xs text-slate-500">Spaces inside an answer are preserved, so phrases like HUMAN COMPUTER INTERACTION are valid.</p>
                          </div>
                        ) : null}

                        {block.type === "essay" ? (
                          <p className="sm:col-span-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                            Essay answers are manually checked. Points are still included in the total score.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addQuestionBlock}
                  className="w-full rounded-[1.4rem] border border-dashed border-sky-200 bg-sky-50/60 px-4 py-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Click to add another question
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-lg text-sky-700 dark:text-sky-300">⏱</span>
                <h3 className="text-base font-semibold text-[var(--foreground)]">Time Management</h3>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Total Duration</p>
              <div className="mt-3 grid grid-cols-3 items-center gap-2 rounded-2xl bg-[var(--surface-elevated)] p-3">
                <div>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center text-xl font-semibold text-[var(--foreground)] shadow-sm outline-none"
                  />
                  <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Hrs</p>
                </div>
                <div className="text-center text-2xl font-light text-[var(--muted)]">:</div>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center text-xl font-semibold text-[var(--foreground)] shadow-sm outline-none"
                  />
                  <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Min</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Test Opens</label>
                  <input
                    type="datetime-local"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Test Closes</label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-white/80 bg-[#071637] p-5 text-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-lg text-cyan-300">🛡</span>
                <h3 className="text-base font-semibold">Anti-Cheat</h3>
                <span className="rounded-full bg-cyan-400/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Enforced</span>
              </div>
              <div className="space-y-3 text-sm">
                <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-semibold">Disable Copy-Paste</p>
                    <p className="text-xs text-white/60">Restrict standard text copying</p>
                  </div>
                  <input type="checkbox" checked={true} readOnly className="h-5 w-5 rounded-full border-white/30 bg-cyan-500 text-cyan-500" />
                </label>
                <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-semibold">Tab Detection</p>
                    <p className="text-xs text-white/60">Flag focus loss events</p>
                  </div>
                  <input type="checkbox" checked={true} readOnly className="h-5 w-5 rounded-full border-white/30 bg-cyan-500 text-cyan-500" />
                </label>
                <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-semibold">Randomize Sequence</p>
                    <p className="text-xs text-white/60">Unique question order</p>
                  </div>
                  <input type="checkbox" checked={true} readOnly className="h-5 w-5 rounded-full border-white/30 bg-cyan-500 text-cyan-500" />
                </label>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-lg text-sky-700 dark:text-sky-300">✓</span>
                <h3 className="text-base font-semibold text-[var(--foreground)]">Feedback</h3>
              </div>
              <div className="space-y-3 text-sm text-[var(--foreground)]">
                <label className="flex items-center justify-between rounded-2xl bg-[var(--surface-elevated)] px-4 py-3">
                  <div>
                    <p className="font-semibold">Allow review</p>
                    <p className="text-xs text-[var(--muted)]">View correct answers</p>
                  </div>
                  <input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} className="h-5 w-5 rounded border-[var(--border)] text-sky-600" />
                </label>
                <label className="flex items-center justify-between rounded-2xl bg-[var(--surface-elevated)] px-4 py-3">
                  <div>
                    <p className="font-semibold">Auto-score</p>
                    <p className="text-xs text-[var(--muted)]">Show results instantly</p>
                  </div>
                  <input type="checkbox" checked={allowAutoScore} onChange={(e) => setAllowAutoScore(e.target.checked)} className="h-5 w-5 rounded border-[var(--border)] text-sky-600" />
                </label>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                    <path d="M6 10V8a6 6 0 1 1 12 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>
                <h3 className="text-base font-semibold text-[var(--foreground)]">Gatekeeping</h3>
              </div>
              <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] pr-2 focus-within:border-sky-400">
                <input
                  type={showQuizPassword ? "text" : "password"}
                  value={quizPassword}
                  onChange={(e) => setQuizPassword(e.target.value)}
                  placeholder="Optional password"
                  className="w-full rounded-2xl border-0 bg-transparent px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => setShowQuizPassword((prev) => !prev)}
                  className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface)]"
                  aria-label={showQuizPassword ? "Hide password" : "Show password"}
                >
                  {showQuizPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10.5 10.5a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M2.5 12c1-4 5-8 9.5-8s8.5 4 9.5 8c-1 4-5 8-9.5 8s-8.5-4-9.5-8z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            </section>
          </aside>
        </form>
      )}
    </section>
  );
}
