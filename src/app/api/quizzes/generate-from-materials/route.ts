import { NextRequest, NextResponse } from "next/server";
import { canManageClasses, getApiAuthProfile } from "@/lib/api-auth";

type BuilderQuestionType = "mcq" | "checkbox" | "dropdown" | "identification" | "essay";

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

type GenerationCounts = {
  mcq: number;
  checkbox: number;
  dropdown: number;
  identification: number;
  essay: number;
};

export const runtime = "nodejs";

function readInteger(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function sanitizeJsonText(rawText: string) {
  return rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");
}

function normalizeQuestionType(value: unknown): BuilderQuestionType | null {
  const type = String(value ?? "").trim() as BuilderQuestionType;
  return ["mcq", "checkbox", "dropdown", "identification", "essay"].includes(type) ? type : null;
}

function normalizeGeneratedQuestion(rawQuestion: any): GeneratedQuestion | null {
  const type = normalizeQuestionType(rawQuestion?.type);
  const content = String(rawQuestion?.content ?? "").trim();
  const options = Array.isArray(rawQuestion?.options)
    ? rawQuestion.options.map((option: unknown) => String(option ?? "").trim()).filter(Boolean)
    : [];
  const correctAnswers = Array.isArray(rawQuestion?.correctAnswers)
    ? rawQuestion.correctAnswers.map((answer: unknown) => String(answer ?? "").trim()).filter(Boolean)
    : [];

  if (!type || !content) {
    return null;
  }

  if (type === "essay") {
    return {
      type,
      content,
      options: [],
      correctAnswers: [],
      required: true,
      points: Math.max(1, Number(rawQuestion?.points ?? 1) || 1),
    };
  }

  if (type === "identification") {
    return {
      type,
      content,
      options: [],
      correctAnswers: correctAnswers.length > 0 ? correctAnswers : [String(rawQuestion?.correctAnswer ?? "").trim()].filter(Boolean),
      required: true,
      points: Math.max(1, Number(rawQuestion?.points ?? 1) || 1),
    };
  }

  if (options.length < 2) {
    return null;
  }

  const normalizedCorrectAnswers = correctAnswers.length > 0 ? correctAnswers : [options[0]];

  return {
    type,
    content,
    options,
    correctAnswers: normalizedCorrectAnswers,
    optionFeedbacks: Array.from({ length: options.length }, () => ""),
    required: true,
    points: Math.max(1, Number(rawQuestion?.points ?? 1) || 1),
  };
}

async function extractSourceText(file: File) {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const pathModule = await import("node:path");
    const urlModule = await import("node:url");
    const workerPath = pathModule.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
    const workerUrl = urlModule.pathToFileURL(workerPath).href;

    // Force a stable worker path in Next.js server runtime to avoid fake-worker chunk resolution issues.
    PDFParse.setWorker(workerUrl);

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return String(result.text || "").trim();
    } finally {
      await parser.destroy();
    }
  }

  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    const mammothModule = await import("mammoth");
    const mammoth = (mammothModule.default ?? mammothModule) as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (
    fileType === "text/plain" ||
    fileType === "text/markdown" ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  ) {
    return buffer.toString("utf8").trim();
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD files.");
}

async function callOpenRouter(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Tesitfy",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You create editable quiz drafts for teachers. Return only valid JSON and follow every requested count exactly.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed: ${errorText}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response was empty.");
  }

  return content;
}

async function authorizeClassManager(auth: { profile: any; supabase: any }, classId: string) {
  const [{ data: classData }, { data: membership }] = await Promise.all([
    auth.supabase.from("classes").select("teacher_id").eq("id", classId).single(),
    auth.supabase
      .from("class_students")
      .select("member_role")
      .eq("class_id", classId)
      .eq("student_id", auth.profile.id)
      .maybeSingle(),
  ]);

  if (!classData) {
    return { error: NextResponse.json({ error: "Class not found." }, { status: 404 }) };
  }

  const isTeacherMemberManager = membership?.member_role === "teacher";
  if (auth.profile.role !== "admin" && classData.teacher_id !== auth.profile.id && !isTeacherMemberManager) {
    return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiAuthProfile();
    if ("error" in auth) {
      return auth.error;
    }

    if (!canManageClasses(auth.profile)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const formData = await request.formData();
    const classId = String(formData.get("classId") ?? "").trim();
    const file = formData.get("file");
    const totalQuestions = readInteger(formData, "totalQuestions");
    const counts: GenerationCounts = {
      mcq: readInteger(formData, "mcqCount") ?? 0,
      checkbox: readInteger(formData, "checkboxCount") ?? 0,
      dropdown: readInteger(formData, "dropdownCount") ?? 0,
      identification: readInteger(formData, "identificationCount") ?? 0,
      essay: readInteger(formData, "essayCount") ?? 0,
    };

    if (!classId) {
      return NextResponse.json({ error: "Class ID is required." }, { status: 400 });
    }

    const permission = await authorizeClassManager(auth, classId);
    if ("error" in permission) {
      return permission.error;
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Reference file is required." }, { status: 400 });
    }

    if (!totalQuestions || totalQuestions < 1) {
      return NextResponse.json({ error: "Total questions must be at least 1." }, { status: 400 });
    }

    const breakdownTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (breakdownTotal !== totalQuestions) {
      return NextResponse.json(
        { error: "The question type counts must add up to the total number of items." },
        { status: 400 },
      );
    }

    const sourceText = await extractSourceText(file);
    if (!sourceText) {
      return NextResponse.json({ error: "The uploaded file does not contain readable text." }, { status: 400 });
    }

    const prompt = [
      `Generate an editable quiz draft from the uploaded reference material for the class ${classId}.`,
      `Total questions required: ${totalQuestions}.`,
      `Question type counts: multiple choice ${counts.mcq}, checkbox ${counts.checkbox}, dropdown ${counts.dropdown}, identification ${counts.identification}, essay ${counts.essay}.`,
      "Use only the supplied reference text as the source. If the text is thin, generate reasonable study questions based on the given material without inventing unrelated facts.",
      "Return JSON only with this exact top-level structure: { \"questions\": [...] }.",
      "Each question object must include: type, content, options, correctAnswers, required, points.",
      "For option-based questions, generate 4 options for multiple choice and dropdown, and 4-5 options for checkbox questions. correctAnswers must contain the correct option text(s).",
      "For identification questions, provide one to three acceptable answers in correctAnswers and keep options empty.",
      "For essay questions, keep options empty and correctAnswers empty.",
      "Make the wording clear and classroom-appropriate. Keep each question concise but specific.",
      "Try to vary difficulty across the set and ensure the questions are directly editable by the teacher.",
      `Uploaded file name: ${file.name}`,
      `Reference text:\n${sourceText.slice(0, 18000)}`,
    ].join("\n\n");

    let aiResponseText: string;
    try {
      aiResponseText = await callOpenRouter(prompt);
    } catch (error) {
      return NextResponse.json(
        {
          error: "AI generation request failed.",
          details: error instanceof Error ? error.message : "Unknown AI call error.",
        },
        { status: 500 },
      );
    }

    const cleanedText = sanitizeJsonText(aiResponseText);
    let parsedPayload: { questions?: unknown };

    try {
      parsedPayload = JSON.parse(cleanedText) as { questions?: unknown };
    } catch {
      return NextResponse.json(
        {
          error: "AI returned invalid JSON.",
          details: cleanedText.slice(0, 600),
        },
        { status: 500 },
      );
    }

    const rawQuestions = Array.isArray(parsedPayload.questions) ? parsedPayload.questions : [];
    const normalizedQuestions = rawQuestions
      .map((question) => normalizeGeneratedQuestion(question))
      .filter((question): question is GeneratedQuestion => Boolean(question));

    if (normalizedQuestions.length !== totalQuestions) {
      return NextResponse.json(
        {
          error: "AI did not return the requested number of questions.",
          details: `Expected ${totalQuestions}, received ${normalizedQuestions.length}.`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ questions: normalizedQuestions }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected server error while generating questions.",
        details: error instanceof Error ? error.message : "Unknown server exception.",
      },
      { status: 500 },
    );
  }
}