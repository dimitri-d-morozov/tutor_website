import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ProgressBar } from "@/components/ui/progress-bar";
import { plural } from "@/lib/labels";
import { formatSpent, isOvertime } from "@/lib/tests/attempt";

type Option = { id: string; text: string };

function parseOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (o): o is Option =>
      typeof o === "object" && o !== null && "id" in o && "text" in o,
  );
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const profile = await requireRole("student");
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("student_test_attempts")
    .select(
      "id, status, score, total, started_at, finished_at, test_templates(id, title, time_limit_min)",
    )
    .eq("id", attemptId)
    .eq("student_id", profile.id)
    .maybeSingle();

  if (!attempt) notFound();

  const { data: rows } = await supabase
    .from("attempt_questions")
    .select(
      "question_id, position, text, type, options, explanation, max_points, given_answer, points, is_correct, tutor_comment",
    )
    .eq("attempt_id", attemptId)
    .order("position");

  const questions = rows ?? [];
  const pendingReview = attempt.status === "pending_review";
  const score = attempt.score ?? 0;
  const total = attempt.total ?? 0;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  const limit = attempt.test_templates?.time_limit_min ?? null;
  const overtime = isOvertime(attempt.started_at, attempt.finished_at, limit);
  const spent = formatSpent(attempt.started_at, attempt.finished_at, limit);

  return (
    <div>
      <Link
        href="/student/tests"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← Ко всем тестам
      </Link>

      <h1 className="mb-1 font-display text-3xl">
        {attempt.test_templates?.title ?? "Тест"}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">Результат</p>

      <Card className="mb-4">
        <div className="mb-3 flex items-end gap-3">
          <div className="font-display text-4xl font-bold text-green-700">
            {score}
          </div>
          <div className="pb-1 text-sm text-ink-soft">
            из {total} {plural(total, "балла", "баллов", "баллов")} · {percent}%
          </div>
        </div>
        <ProgressBar value={percent} />

        {spent && (
          <p
            className={
              overtime
                ? "mt-3 rounded-sm bg-coral-100 px-3 py-2 text-sm text-coral"
                : "mt-3 text-xs text-ink-faint"
            }
          >
            {overtime
              ? `Вы не уложились в лимит: ${spent}. Ответы всё равно зачтены — репетитор увидит превышение.`
              : `Затрачено: ${spent}`}
          </p>
        )}

        {pendingReview && (
          <p className="mt-4 rounded-sm bg-amber-200 px-3 py-2 text-sm text-amber-600">
            Это балл за вопросы с выбором. Развёрнутые ответы проверит
            репетитор — тогда балл обновится, и здесь появится его комментарий.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const options = parseOptions(q.options);
          const given = asText(q.given_answer);
          const isOpen = q.type === "open";
          const awaiting = isOpen && q.points === null;
          const points = q.points ?? 0;
          const max = q.max_points ?? 1;

          return (
            <Card key={q.question_id ?? i}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-ink-faint">
                  Вопрос {i + 1}
                </span>
                {awaiting ? (
                  <Tag tone="amber">на проверке</Tag>
                ) : (
                  <Tag
                    tone={
                      points === max ? "green" : points > 0 ? "amber" : "coral"
                    }
                  >
                    {points} из {max}
                  </Tag>
                )}
              </div>

              <div className="mb-3 font-display text-lg">{q.text}</div>

              {isOpen ? (
                <div className="rounded-sm border-l-2 border-border bg-surface-muted px-3 py-2 text-sm">
                  <span className="text-ink-faint">Ваш ответ: </span>
                  {given || <span className="text-ink-faint">без ответа</span>}
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {options.map((o) => {
                    const chosen = given === o.id;
                    return (
                      <li
                        key={o.id}
                        className={
                          chosen
                            ? q.is_correct
                              ? "rounded-sm bg-green-100 px-3 py-2 text-sm font-medium text-green-700"
                              : "rounded-sm bg-coral-100 px-3 py-2 text-sm font-medium text-coral"
                            : "px-3 py-2 text-sm text-ink-soft"
                        }
                      >
                        {o.text}
                        {chosen && (q.is_correct ? " — ваш ответ ✓" : " — ваш ответ ✗")}
                      </li>
                    );
                  })}
                </ul>
              )}

              {q.tutor_comment && (
                <div className="mt-3 rounded-sm border-l-2 border-amber-500 bg-surface px-3 py-2 text-sm">
                  <span className="text-ink-faint">Комментарий репетитора: </span>
                  {q.tutor_comment}
                </div>
              )}

              {/* Пояснение показываем только после проверки: у ожидающего
                  ответа оно подсказало бы правильный ход мысли задним числом. */}
              {q.explanation && !awaiting && (
                <p className="mt-3 text-xs text-ink-soft">{q.explanation}</p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <Button href="/student/mistakes" variant="outline">
          Работа над ошибками
        </Button>
        <Button href="/student/tests" variant="ghost">
          Ко всем тестам
        </Button>
      </div>
    </div>
  );
}
