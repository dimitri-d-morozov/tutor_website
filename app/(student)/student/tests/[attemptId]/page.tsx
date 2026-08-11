import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TestRunner,
  type RunnerQuestion,
} from "@/components/student/test-runner";

type Option = { id: string; text: string };

function parseOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (o): o is Option =>
      typeof o === "object" && o !== null && "id" in o && "text" in o,
  );
}

/** given_answer — JSONB; в наших ответах это всегда строка. */
function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const profile = await requireRole("student");
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("student_test_attempts")
    .select("id, status, started_at, test_templates(title, time_limit_min)")
    .eq("id", attemptId)
    .eq("student_id", profile.id)
    .maybeSingle();

  if (!attempt) notFound();

  // Сданную попытку не даём проходить заново — только смотреть результат.
  if (attempt.status !== "in_progress") {
    redirect(`/student/tests/${attemptId}/result`);
  }

  // Вопросы берём из attempt_questions — там нет correct_answer, поэтому даже
  // при чтении исходников страницы верные ответы не увидеть.
  const { data: rows } = await supabase
    .from("attempt_questions")
    .select("question_id, position, text, type, options, max_points, given_answer")
    .eq("attempt_id", attemptId)
    .order("position");

  const questions: RunnerQuestion[] = (rows ?? [])
    .filter((r) => r.question_id !== null)
    .map((r) => ({
      questionId: r.question_id!,
      position: r.position ?? 0,
      text: r.text ?? "",
      type: r.type === "open" ? "open" : r.type === "multiple_choice" ? "multiple_choice" : "single_choice",
      maxPoints: r.max_points ?? 1,
      options: parseOptions(r.options),
      savedAnswer: asText(r.given_answer),
    }));

  const limit = attempt.test_templates?.time_limit_min ?? null;
  const deadline = limit
    ? new Date(
        new Date(attempt.started_at).getTime() + limit * 60_000,
      ).toISOString()
    : null;

  return (
    <TestRunner
      attemptId={attempt.id}
      title={attempt.test_templates?.title ?? "Тест"}
      questions={questions}
      deadline={deadline}
    />
  );
}
